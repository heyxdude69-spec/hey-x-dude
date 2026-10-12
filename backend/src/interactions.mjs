import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { HttpError } from './catalog.mjs';

const interactionSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewerHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  vote: { type: String, enum: ['like', 'dislike', null], default: null },
  lastViewedAt: Date, commentWindowStart: Date, commentCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true, collection: 'video_interactions', strict: 'throw', autoIndex: false, autoCreate: false });
interactionSchema.index({ videoId: 1, viewerHash: 1 }, { unique: true, name: 'unique_video_visitor' });
const commentSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewerHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  requestId: { type: String, required: true, maxlength: 36 },
  name: { type: String, trim: true, required: true, maxlength: 80 },
  text: { type: String, trim: true, required: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, moderatedAt: Date,
}, { timestamps: true, collection: 'video_comments', strict: 'throw', autoIndex: false, autoCreate: false });
commentSchema.index({ videoId: 1, status: 1, _id: -1 }, { name: 'public_comments' });
commentSchema.index({ status: 1, _id: -1 }, { name: 'moderation_queue' });
commentSchema.index({ videoId: 1, viewerHash: 1, requestId: 1 }, { unique: true, name: 'unique_comment_submission' });

export function interactionModels(connection) {
  return { Interaction: connection.models.VideoInteraction || connection.model('VideoInteraction', interactionSchema),
    Comment: connection.models.VideoComment || connection.model('VideoComment', commentSchema) };
}
export async function setupInteractions(database) {
  const models = interactionModels(database.connection);
  const common = { _id: { bsonType: 'objectId' }, __v: { bsonType: 'int' }, videoId: { bsonType: 'objectId' },
    viewerHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } };
  const validators = {
    video_interactions: { $jsonSchema: { bsonType: 'object', additionalProperties: false, required: ['videoId', 'viewerHash'], properties: {
      ...common, vote: { enum: ['like', 'dislike', null] }, lastViewedAt: { bsonType: 'date' }, commentWindowStart: { bsonType: 'date' },
      commentCount: { bsonType: ['int', 'double'], minimum: 0, maximum: 3, multipleOf: 1 },
    } } },
    video_comments: { $jsonSchema: { bsonType: 'object', additionalProperties: false, required: ['videoId', 'viewerHash', 'requestId', 'name', 'text', 'status'], properties: {
      ...common, requestId: { bsonType: 'string', maxLength: 36 }, name: { bsonType: 'string', minLength: 1, maxLength: 80 },
      text: { bsonType: 'string', minLength: 1, maxLength: 2000 }, status: { enum: ['pending', 'approved', 'rejected'] }, moderatedAt: { bsonType: 'date' },
    } } },
  };
  for (const model of Object.values(models)) {
    const name = model.collection.collectionName, validator = validators[name];
    await model.createCollection({ validator, validationLevel: 'strict', validationAction: 'error' });
    await database.connection.db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    await model.createIndexes();
  }
}
export function voteDelta(previous, next) {
  return { likes: Number(next === 'like') - Number(previous === 'like'),
    dislikes: Number(next === 'dislike') - Number(previous === 'dislike') };
}
export function interactionSummary(metrics = {}, vote = null) {
  const likes = metrics.likes || 0, dislikes = metrics.dislikes || 0;
  return { views: metrics.views || 0, likes, dislikes, vote, rating: likes + dislikes ? Math.round(likes / (likes + dislikes) * 100) : null };
}
export function makeInteractions(database, config, models = interactionModels(database.connection)) {
  const { Interaction, Comment } = models;
  const timeout = config.queryTimeoutMs;
  const hash = visitor => createHash('sha256').update(`${config.interactionSecret}:${visitor}`).digest('hex');
  async function video(slug, session) {
    const row = await database.Video.findOne({ slug, status: 'published' }).select('_id metrics')
      .session(session || null).maxTimeMS(timeout).lean();
    if (!row) throw new HttpError(404, 'Video not found');
    return row;
  }
  async function transaction(run) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = await database.connection.startSession();
      try { return await session.withTransaction(() => run(session), { maxCommitTimeMS: 5000 }); }
      catch (error) { if (error.code !== 11000 || attempt === 2) throw error; }
      finally { await session.endSession(); }
    }
  }
  return {
    async get(slug, visitor) {
      const row = await video(slug);
      const state = await Interaction.findOne({ videoId: row._id, viewerHash: hash(visitor) }).select('vote').maxTimeMS(timeout).lean();
      return interactionSummary(row.metrics, state?.vote);
    },
    async update(slug, visitor, action, vote) {
      return transaction(async session => {
        const row = await video(slug, session), key = { videoId: row._id, viewerHash: hash(visitor) };
        let state = await Interaction.findOne(key).session(session).maxTimeMS(timeout);
        if (!state) state = new Interaction(key);
        const delta = action === 'vote' ? voteDelta(state.vote, vote) : { likes: 0, dislikes: 0 };
        let viewDelta = 0;
        if (action === 'vote') state.vote = vote;
        if (action === 'view' && (!state.lastViewedAt || Date.now() - state.lastViewedAt.getTime() >= 86400000)) {
          viewDelta = 1; state.lastViewedAt = new Date();
        }
        await state.save({ session });
        if (delta.likes || delta.dislikes || viewDelta) {
          await database.Video.updateOne({ _id: row._id }, [{ $set: {
            'metrics.likes': { $max: [0, { $add: [{ $ifNull: ['$metrics.likes', 0] }, delta.likes] }] },
            'metrics.dislikes': { $max: [0, { $add: [{ $ifNull: ['$metrics.dislikes', 0] }, delta.dislikes] }] },
            'metrics.views': { $add: [{ $ifNull: ['$metrics.views', 0] }, viewDelta] },
          } }], { session, timestamps: false, updatePipeline: true }).maxTimeMS(timeout);
        }
        const current = await video(slug, session);
        return interactionSummary(current.metrics, state.vote);
      });
    },
    async comments(slug, before) {
      const row = await video(slug);
      const rows = await Comment.find({ videoId: row._id, status: 'approved', ...(before ? { _id: { $lt: before } } : {}) })
        .select('name text createdAt').sort({ _id: -1 }).limit(21).maxTimeMS(timeout).lean();
      return { comments: rows.slice(0, 20).map(comment => ({ id: String(comment._id), name: comment.name, text: comment.text, createdAt: comment.createdAt })),
        nextCursor: rows.length > 20 ? String(rows[19]._id) : null };
    },
    async submit(slug, visitor, input) {
      return transaction(async session => {
        const row = await video(slug, session), key = { videoId: row._id, viewerHash: hash(visitor) };
        const existing = await Comment.findOne({ ...key, requestId: input.requestId }).session(session).maxTimeMS(timeout).lean();
        if (existing) return { id: String(existing._id), status: existing.status };
        let state = await Interaction.findOne(key).session(session).maxTimeMS(timeout);
        if (!state) state = new Interaction(key);
        if (!state.commentWindowStart || Date.now() - state.commentWindowStart.getTime() >= 3600000) {
          state.commentWindowStart = new Date(); state.commentCount = 0;
        }
        if (state.commentCount >= 3) throw new HttpError(429, 'Maximum three comments per hour');
        state.commentCount++;
        await state.save({ session });
        const comment = new Comment({ ...key, ...input, status: 'pending' });
        await comment.save({ session });
        return { id: String(comment._id), status: 'pending' };
      });
    },
  };
}
