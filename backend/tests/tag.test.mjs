import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCatalog } from '../src/catalog.mjs';

test('tag listings isolate published content ratings, paginate latest first and reject missing pages', async () => {
  const filters = [], operations = [];
  const Video = {
    countDocuments(filter) { filters.push(filter); return { maxTimeMS: async () => 26 }; },
    find(filter) {
      filters.push(filter);
      const chain = { select() { return this; }, sort(value) { operations.push(['sort', value]); return this; },
        skip(value) { operations.push(['skip', value]); return this; }, limit(value) { operations.push(['limit', value]); return this; },
        lean() { return this; }, maxTimeMS: async () => [{ _id: 'id', slug: 'forest', title: 'Forest', tags: ['nature'] }] };
      return chain;
    },
  };
  const catalog = makeCatalog({ Video }, { getOrLoad: (_key, loader) => loader() }, { providerHosts: {}, queryTimeoutMs: 1000 });
  const page = await catalog.tag('nature', { page: 2, rating: 'adult' });
  assert.deepEqual(filters[0], { tags: 'nature', status: 'published', contentRating: 'adult' });
  assert.deepEqual(filters[1], filters[0]);
  assert.deepEqual(operations, [['sort', { publishedAt: -1, _id: -1 }], ['skip', 25], ['limit', 25]]);
  assert.equal(page.pagination.totalVideos, 26);
  assert.equal(page.pagination.pageCount, 2);
  assert.equal(page.videos[0].url, '/forest');
  assert.equal(await catalog.tag('nature', { page: 3 }), null);
  Video.countDocuments = () => ({ maxTimeMS: async () => 0 });
  assert.equal(await catalog.tag('missing'), null);
});
