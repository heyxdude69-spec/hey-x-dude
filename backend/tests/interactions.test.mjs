import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { modelsFor } from '../src/models.mjs';
import { makeInteractions, voteDelta, interactionSummary } from '../src/interactions.mjs';
function fixture() {
  const validationModel = modelsFor(mongoose.createConnection()).Video;
  let metrics = { views: 7, likes: 2, dislikes: 1 }, states = new Map(), comments = new Map(), nextId = 0;
  const q = value => ({ session() { return this; }, select() { return this; }, maxTimeMS() { return this; }, lean() { return this; },
    sort() { return this; }, limit() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  const key = row => `${row.videoId}:${row.viewerHash}`;
  class Interaction {
    constructor(row) { Object.assign(this, { vote: null, commentCount: 0 }, structuredClone(row)); }
    static findOne(filter) { const row = states.get(key(filter)); return q(row ? new Interaction(row) : null); }
    async save() { states.set(key(this), structuredClone({ ...this })); }
  }
  class Comment {
    constructor(row) { Object.assign(this, structuredClone(row)); this._id = String(++nextId); this.createdAt = new Date(); }
    static findOne(filter) { return q([...comments.values()].find(row => key(row) === key(filter) && row.requestId === filter.requestId) || null); }
    static find(filter) { assert.equal(filter.status, 'approved'); return q([...comments.values()].filter(row => row.status === filter.status)); }
    async save() { comments.set(this._id, structuredClone({ ...this })); }
  }
  function evaluate(expression) {
    if (typeof expression === 'number') return expression;
    if (typeof expression === 'string') return metrics[expression.split('.')[1]];
    if (expression.$ifNull) return evaluate(expression.$ifNull[0]) ?? expression.$ifNull[1];
    if (expression.$add) return expression.$add.map(evaluate).reduce((a,b) => a+b, 0);
    if (expression.$max) return Math.max(...expression.$max.map(evaluate));
    throw new Error('Unexpected database expression');
  }
  const database = { connection: { async startSession() { return { async withTransaction(run) {
    const savedMetrics = structuredClone(metrics), savedStates = structuredClone(states), savedComments = structuredClone(comments);
    try { return await run(); } catch(error) { metrics = savedMetrics; states = savedStates; comments = savedComments; throw error; }
  }, async endSession() {} }; } }, Video: {
    findOne(filter) { return q(filter.slug === 'forest' ? { _id: 'video', metrics: structuredClone(metrics) } : null); },
    updateOne(_filter, stages, options) { assert.doesNotThrow(() => validationModel.updateOne({}, stages, options)); const updates = Object.fromEntries(Object.entries(stages[0].$set).map(([field, value]) => [field.split('.')[1], evaluate(value)])); metrics = { ...metrics, ...updates }; return q({ modifiedCount: 1 }); },
  } };
  return { api: makeInteractions(database, { queryTimeoutMs: 1000, interactionSecret: 's'.repeat(64) }, { Interaction, Comment }),
    approve() { for (const comment of comments.values()) comment.status = 'approved'; }, comments: () => comments.size };
}
test('votes are persistent and idempotent; switching/removing adjusts both counters correctly', async () => {
  assert.deepEqual(voteDelta('like', 'dislike'), { likes: -1, dislikes: 1 });
  assert.equal(interactionSummary().rating, null);
  const { api } = fixture();
  assert.equal((await api.update('forest', 'visitor', 'vote', 'like')).likes, 3);
  assert.equal((await api.update('forest', 'visitor', 'vote', 'like')).likes, 3);
  const switched = await api.update('forest', 'visitor', 'vote', 'dislike');
  assert.equal(switched.likes, 2); assert.equal(switched.dislikes, 2);
  assert.equal((await api.get('forest', 'visitor')).vote, 'dislike');
  assert.equal((await api.update('forest', 'visitor', 'vote', null)).dislikes, 1);
  await assert.rejects(api.update('missing', 'visitor', 'vote', 'like'), /not found/);
});
test('repeat view requests count once per visitor/video within the daily window', async () => {
  const { api } = fixture();
  assert.equal((await api.update('forest', 'visitor', 'view')).views, 8);
  assert.equal((await api.update('forest', 'visitor', 'view')).views, 8);
  assert.equal((await api.update('forest', 'second', 'view')).views, 9);
});
test('pending comments stay private, submissions deduplicate, and hourly limit applies', async () => {
  const { api, approve, comments } = fixture();
  const input = { name: 'Reader', text: '<script>example</script>', requestId: 'request-1' };
  const first = await api.submit('forest', 'visitor', input);
  assert.equal(first.status, 'pending');
  assert.equal((await api.submit('forest', 'visitor', input)).id, first.id);
  assert.equal(comments(), 1); assert.equal((await api.comments('forest')).comments.length, 0);
  approve(); assert.equal((await api.comments('forest')).comments[0].text, input.text);
  await api.submit('forest', 'visitor', { ...input, requestId: 'request-2' });
  await api.submit('forest', 'visitor', { ...input, requestId: 'request-3' });
  await assert.rejects(api.submit('forest', 'visitor', { ...input, requestId: 'request-4' }), /three comments/);
  assert.equal(comments(), 3);
});
