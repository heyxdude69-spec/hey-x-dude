import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCatalog } from '../src/catalog.mjs';
test('watch page returns up to 16 playable recommendations, prioritizes tags and falls back to primary category', async () => {
  const video = { _id: 'self', slug: 'forest', title: 'Forest', status: 'published', contentRating: 'general', tags: ['trees'], categories: ['nature'] };
  const candidates = Array.from({ length: 22 }, (_, i) => ({ _id: `id-${i}`, slug: `walk-${i}`, title: `Walk ${i}`, status: 'published', contentRating: 'general',
    tags: i < 5 ? ['trees'] : [], categories: ['nature'], publishedAt: new Date(2026, 0, 22-i) }));
  function chain(value) { return { select() { return this; }, sort() { return this; }, limit(n) { assert.ok(n <= 48); return this; }, lean() { return this; }, maxTimeMS: async () => value }; }
  const database = { Video: {
    findOne: () => chain(video), find(filter) {
      assert.equal(filter.status, 'published'); assert.equal(filter.contentRating, 'general'); assert.equal(filter._id.$ne, 'self');
      return chain(filter.tags ? candidates.slice(0, 5) : candidates);
    },
  }, VideoSource: { find: () => chain([{ _id: 'source', provider: 'voe', kind: 'embed', enabled: true, status: 'ready', priority: 1, embedUrl: 'https://voe.sx/e/example' }]),
    aggregate: () => ({ option: async () => candidates.filter(v => v._id !== 'id-2').map(v => ({ _id: v._id })) }) },
    Category: { find: () => chain([{ slug: 'nature', name: 'Nature' }]) } };
  const result = await makeCatalog(database, { getOrLoad: (_key, run) => run() }, { queryTimeoutMs: 1000, providerHosts: { voe: ['voe.sx'] }, siteOrigin: 'https://site.test' }).page('forest');
  assert.equal(result.recommendations.length, 16);
  assert.equal(new Set(result.recommendations.map(v => v.id)).size, 16);
  assert.ok(!result.recommendations.some(v => v.id === 'id-2'));
  assert.ok(result.recommendations.slice(0, 4).every(v => v.tags.includes('trees')));
  assert.equal(result.video.canonicalUrl, 'https://site.test/forest');
  assert.equal(result.recommendations[0].url, '/walk-0');
});
