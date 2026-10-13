import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { SEARCH_INDEX_KEYS, SEARCH_INDEX_OPTIONS } from './search.mjs';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROVIDERS = ['voe', 'filemoon', 'playmate', 'vidara', 'lulustream', 'direct', 'reference'];
export const httpsUrl = value => value == null || (() => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
})();
export const normalizeTags = values => [...new Set((values || []).map(value =>
  String(value).normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
).filter(Boolean))];

const string = (max, extra = {}) => ({ type: String, trim: true, maxlength: max, ...extra });
const thumbnail = new mongoose.Schema({
  url: string(2048, { validate: httpsUrl }), alt: string(300, { default: '' }),
  width: { type: Number, min: 1, max: 20000 }, height: { type: Number, min: 1, max: 20000 },
}, { _id: false, strict: 'throw' });
const seo = new mongoose.Schema({
  title: string(300, { default: '' }), metaDescription: string(1000, { default: '' }),
  targetKeyword: string(200, { default: '' }), indexAllowed: { type: Boolean, default: true },
}, { _id: false, strict: 'throw' });
const media = new mongoose.Schema({
  width: { type: Number, min: 1, max: 32768, validate: Number.isInteger },
  height: { type: Number, min: 1, max: 32768, validate: Number.isInteger },
  fps: { type: Number, min: 0, max: 1000 }, videoCodec: string(80), audioCodec: string(80),
  fileSizeBytes: { type: Number, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  sha256: { type: String, match: /^[a-f0-9]{64}$/ },
  quality: { type: String, enum: ['sd', 'hd', 'fullhd', 'uhd'] },
}, { _id: false, strict: 'throw' });
const metrics = new mongoose.Schema({
  views: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 0 },
  likes: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 0 },
  dislikes: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 0 },
  ratingAverage: { type: Number, min: 0, max: 5 },
  ratingCount: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, default: 0 },
  origin: { type: String, enum: ['seed', 'site'], default: 'seed' },
}, { _id: false, strict: 'throw' });

export const videoSchema = new mongoose.Schema({
  recommendationBadgeSeed: string(16, { match: /^[a-f0-9]{16}$/, default: () => randomBytes(8).toString('hex') }),
  slug: string(180, { required: true, match: SLUG_PATTERN, immutable: true }),
  title: string(300, { required: true }), h1: string(300, { default: '' }),
  description: string(5000, { default: '' }), bodyText: string(30000, { default: '' }),
  language: string(30, { default: 'en', match: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/ }),
  seo: { type: seo, default: () => ({}) }, thumbnail: { type: thumbnail, default: () => ({}) },
  tags: { type: [String], default: [], set: normalizeTags, validate: values => values.length <= 32 && values.every(v => v.length <= 80) },
  categories: { type: [String], default: [], set: normalizeTags, validate: values => values.length <= 12 && values.every(v => v.length <= 80) },
  durationSeconds: { type: Number, min: 1, max: 86400, validate: Number.isInteger },
  media: { type: media, default: () => ({}) }, metrics: { type: metrics, default: () => ({}) },
  uploadDate: Date, publishedAt: Date, transcript: string(100000, { default: '' }), author: string(150, { default: '' }),
  contentRating: { type: String, enum: ['unknown', 'general', 'adult'], default: 'unknown' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  importReference: { type: String, maxlength: 2048, select: false },
}, { timestamps: true, collection: 'videos', strict: 'throw', autoIndex: false, optimisticConcurrency: true });

videoSchema.pre('validate', function () {
  if (this.status !== 'published') return;
  if (['categories', 'api', 'tag', 'video', 'assets', 'health', 'sitemaps'].includes(this.slug)) this.invalidate('slug', 'Slug conflicts with a reserved frontend route');
  for (const key of ['title', 'h1', 'description', 'seo.title', 'seo.metaDescription', 'thumbnail.url', 'uploadDate', 'publishedAt']) {
    if (!this.get(key)) this.invalidate(key, `${key} is required before publishing`);
  }
  if (this.contentRating === 'unknown') this.invalidate('contentRating', 'Classify the video before publishing');
});
videoSchema.index({ slug: 1 }, { unique: true, name: 'unique_slug' });
videoSchema.index(SEARCH_INDEX_KEYS, SEARCH_INDEX_OPTIONS);
videoSchema.index({ status: 1, contentRating: 1, publishedAt: -1, _id: -1 }, { name: 'published_listing' });
videoSchema.index({ tags: 1, status: 1, contentRating: 1, publishedAt: -1, _id: -1 }, { name: 'tag_recommendations' });
videoSchema.index({ categories: 1, status: 1, contentRating: 1, publishedAt: -1, _id: -1 }, { name: 'category_listing' });
videoSchema.index({ status: 1, 'seo.indexAllowed': 1, _id: 1 }, { name: 'sitemap_cursor' });

export const sourceSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Video', immutable: true },
  provider: { type: String, enum: PROVIDERS, required: true, immutable: true },
  externalVideoId: string(300, { required: true, immutable: true }),
  slot: { type: Number, required: true, min: 0, max: 19, validate: Number.isInteger, immutable: true },
  kind: { type: String, enum: ['embed', 'direct'], required: true },
  embedUrl: string(2048, { validate: httpsUrl }), contentUrl: string(2048, { validate: httpsUrl }),
  priority: { type: Number, default: 100, min: 0, max: 10000, validate: Number.isInteger },
  enabled: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'processing', 'ready', 'failed', 'removed'], default: 'pending' },
  availability: { type: String, enum: ['unknown', 'available', 'unavailable'], default: 'unknown' },
  lastCheckedAt: Date, lastError: string(500),
  providerMetadata: { type: new mongoose.Schema({
    videoId: string(100), watchUrl: string(2048, { validate: httpsUrl }), posterUrl: string(2048, { validate: httpsUrl }),
    durationSeconds: { type: Number, min: 0, max: 86400 },
    views: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
    width: { type: Number, min: 1, max: 32768 }, height: { type: Number, min: 1, max: 32768 }, syncedAt: Date,
  }, { _id: false, strict: 'throw' }), default: () => ({}) },
  providerData: { type: mongoose.Schema.Types.Mixed, select: false, validate: value => JSON.stringify(value || {}).length <= 32768 },
}, { timestamps: true, collection: 'video_sources', strict: 'throw', autoIndex: false, optimisticConcurrency: true });
sourceSchema.pre('validate', function () {
  if (this.status === 'ready' && !this.get(this.kind === 'embed' ? 'embedUrl' : 'contentUrl')) {
    this.invalidate('kind', 'A ready source requires its matching embedUrl/contentUrl');
  }
});
sourceSchema.index({ provider: 1, externalVideoId: 1 }, { unique: true, name: 'unique_provider_file' });
sourceSchema.index({ videoId: 1, slot: 1 }, { unique: true, name: 'bounded_source_slots' });
sourceSchema.index({ videoId: 1, enabled: 1, status: 1, priority: 1, _id: 1 }, { name: 'source_selection' });

export const categorySchema = new mongoose.Schema({
  slug: string(80, { required: true, match: SLUG_PATTERN, immutable: true }),
  name: string(150, { required: true }), description: string(5000, { default: '' }),
  h1: string(300, { default: '' }), bodyText: string(30000, { default: '' }),
  language: string(30, { default: 'en', match: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/ }),
  seo: { type: seo, default: () => ({}) }, thumbnail: { type: thumbnail, default: () => ({}) },
  contentRating: { type: String, enum: ['general', 'adult'], default: 'general' },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
}, { timestamps: true, collection: 'categories', strict: 'throw', autoIndex: false, optimisticConcurrency: true });
categorySchema.pre('validate', function () {
  if (this.status !== 'active') return;
  for (const key of ['description', 'seo.title', 'seo.metaDescription']) {
    if (!this.get(key)) this.invalidate(key, `${key} is required for an active category`);
  }
});
categorySchema.index({ slug: 1 }, { unique: true, name: 'unique_category_slug' });
categorySchema.index({ status: 1, contentRating: 1, slug: 1 }, { name: 'category_directory' });
categorySchema.index({ status: 1, 'seo.indexAllowed': 1, _id: 1 }, { name: 'category_sitemap' });

export function modelsFor(connection) {
  return {
    Video: connection.models.Video || connection.model('Video', videoSchema),
    VideoSource: connection.models.VideoSource || connection.model('VideoSource', sourceSchema),
    Category: connection.models.Category || connection.model('Category', categorySchema),
  };
}

export async function connectDatabase(config, databaseName) {
  const connection = await mongoose.createConnection(config.mongoUri, {
    ...(databaseName ? { dbName: databaseName } : {}),
    maxPoolSize: config.mongoPoolSize, minPoolSize: 0, maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 10000, waitQueueTimeoutMS: 3000,
    autoIndex: false, autoCreate: false,
  }).asPromise();
  return { connection, ...modelsFor(connection) };
}

export async function setupDatabase(database) {
  const db = database.connection.db;
  const common = { _id: { bsonType: 'objectId' }, __v: { bsonType: 'int' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } };
  const text = { bsonType: 'string' }, optionalDate = { bsonType: ['date', 'null'] };
  const validators = {
    categories: { $and: [{ $jsonSchema: {
      bsonType: 'object', required: ['slug', 'name', 'status', 'contentRating'], additionalProperties: false,
      properties: { ...common,
        slug: { bsonType: 'string', pattern: SLUG_PATTERN.source, maxLength: 80 },
        name: { bsonType: 'string', minLength: 1, maxLength: 150 }, description: text,
        h1: { bsonType: 'string', maxLength: 300 }, bodyText: { bsonType: 'string', maxLength: 30000 },
        language: { bsonType: 'string', maxLength: 30, pattern: '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$' },
        seo: { bsonType: 'object', additionalProperties: false, properties: { title: text, metaDescription: text, targetKeyword: text, indexAllowed: { bsonType: 'bool' } } },
        thumbnail: { bsonType: 'object', additionalProperties: false, properties: { url: text, alt: text, width: { bsonType: ['int', 'double'] }, height: { bsonType: ['int', 'double'] } } },
        contentRating: { enum: ['general', 'adult'] }, status: { enum: ['draft', 'active', 'archived'] },
      },
    } }, { $or: [{ status: { $ne: 'active' } }, {
      description: { $type: 'string', $ne: '' }, 'seo.title': { $type: 'string', $ne: '' }, 'seo.metaDescription': { $type: 'string', $ne: '' },
    }] }] },
    videos: { $and: [{ $jsonSchema: {
      bsonType: 'object', required: ['slug', 'title', 'status', 'tags', 'contentRating'], additionalProperties: false,
      properties: { ...common, recommendationBadgeSeed: { bsonType: 'string', pattern: '^[a-f0-9]{16}$' }, slug: { bsonType: 'string', pattern: SLUG_PATTERN.source, maxLength: 180 },
        title: { bsonType: 'string', minLength: 1, maxLength: 300 }, h1: text, description: text, bodyText: text, language: text,
        seo: { bsonType: 'object', additionalProperties: false, properties: { title: text, metaDescription: text, targetKeyword: text, indexAllowed: { bsonType: 'bool' } } },
        thumbnail: { bsonType: 'object', additionalProperties: false, properties: { url: text, alt: text, width: { bsonType: ['int', 'double'] }, height: { bsonType: ['int', 'double'] } } },
        tags: { bsonType: 'array', maxItems: 32, uniqueItems: true, items: { bsonType: 'string', maxLength: 80 } },
        categories: { bsonType: 'array', maxItems: 12, uniqueItems: true, items: { bsonType: 'string', maxLength: 80 } },
        durationSeconds: { bsonType: ['int', 'double', 'null'], minimum: 1, maximum: 86400 }, uploadDate: optionalDate, publishedAt: optionalDate,
        transcript: text, author: text, importReference: text,
        media: { bsonType: 'object', additionalProperties: false, properties: {
          width: { bsonType: ['int', 'double'], minimum: 1, maximum: 32768, multipleOf: 1 }, height: { bsonType: ['int', 'double'], minimum: 1, maximum: 32768, multipleOf: 1 },
          fps: { bsonType: ['int', 'double'], minimum: 0, maximum: 1000 }, videoCodec: text, audioCodec: text,
          fileSizeBytes: { bsonType: ['int', 'double', 'long'], minimum: 1, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          sha256: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, quality: { enum: ['sd', 'hd', 'fullhd', 'uhd'] },
        } },
        metrics: { bsonType: 'object', additionalProperties: false, properties: {
          views: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          likes: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          dislikes: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          ratingCount: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          ratingAverage: { bsonType: ['int', 'double'], minimum: 0, maximum: 5 }, origin: { enum: ['seed', 'site'] },
        } },
        contentRating: { enum: ['unknown', 'general', 'adult'] }, status: { enum: ['draft', 'published', 'archived'] },
      },
    } }, { $or: [{ status: { $ne: 'published' } }, {
      'seo.title': { $type: 'string', $ne: '' }, 'seo.metaDescription': { $type: 'string', $ne: '' },
      h1: { $type: 'string', $ne: '' }, description: { $type: 'string', $ne: '' },
      'thumbnail.url': { $regex: '^https://' }, uploadDate: { $type: 'date' }, publishedAt: { $type: 'date' }, contentRating: { $in: ['general', 'adult'] },
    }] }] },
    video_sources: { $and: [{ $jsonSchema: {
      bsonType: 'object', required: ['videoId', 'provider', 'externalVideoId', 'slot', 'kind', 'priority', 'enabled', 'status', 'availability'], additionalProperties: false,
      properties: { ...common, videoId: { bsonType: 'objectId' }, provider: { enum: PROVIDERS }, externalVideoId: { bsonType: 'string', minLength: 1, maxLength: 300 },
        slot: { bsonType: ['int', 'double'], minimum: 0, maximum: 19, multipleOf: 1 },
        kind: { enum: ['embed', 'direct'] }, embedUrl: text, contentUrl: text,
        priority: { bsonType: ['int', 'double'], minimum: 0, maximum: 10000, multipleOf: 1 }, enabled: { bsonType: 'bool' },
        status: { enum: ['pending', 'processing', 'ready', 'failed', 'removed'] }, availability: { enum: ['unknown', 'available', 'unavailable'] },
        lastCheckedAt: optionalDate, lastError: text,
        providerMetadata: { bsonType: 'object', additionalProperties: false, properties: { videoId: text, watchUrl: text, posterUrl: text,
          durationSeconds: { bsonType: ['int', 'double'], minimum: 0, maximum: 86400 }, views: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
          width: { bsonType: ['int', 'double'], minimum: 1, maximum: 32768 }, height: { bsonType: ['int', 'double'], minimum: 1, maximum: 32768 }, syncedAt: optionalDate } },
        providerData: { bsonType: 'object' },
      },
    } }, { $or: [{ status: { $ne: 'ready' } }, { kind: 'embed', embedUrl: { $regex: '^https://' } }, { kind: 'direct', contentUrl: { $regex: '^https://' } }] }] },
  };
  const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  for (const [name, validator] of Object.entries(validators)) {
    if (collections.has(name)) await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    else await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  }
  await database.Video.createIndexes();
  await database.VideoSource.createIndexes();
  await database.Category.createIndexes();
}
