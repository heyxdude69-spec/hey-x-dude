import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCatalog } from '../src/catalog.mjs';

test('category cards use latest published poster, rating-scoped counts and stable pagination', async () => {
  const rows = [{ _id: 'a', slug: 'forest', name: 'Forest', thumbnail: { url: 'https://old.test/a.jpg' } },
    { _id: 'b', slug: 'travel', name: 'Travel' }, { _id: 'c', slug: 'wildlife', name: 'Wildlife' }];
  let latestCalls = 0;
  function chain(value) {
    return { select() { return this; }, sort(sort) {
      if (sort.publishedAt) assert.deepEqual(sort, { publishedAt: -1, _id: -1 });
      return this;
    }, limit(n) { assert.equal(n, 3); return this; }, lean() { return this; },
    maxTimeMS(n) { assert.equal(n, 1500); return Promise.resolve(value); } };
  }
  const catalog = makeCatalog({
    Category: { find(filter) { assert.equal(filter.status, 'active'); assert.equal(filter.contentRating, 'general'); return chain(rows); } },
    Video: {
      aggregate(stages) {
        assert.deepEqual(stages[0].$match, { status: 'published', contentRating: 'general', categories: { $in: ['forest', 'travel'] } });
        assert.deepEqual(stages[2].$match, { categories: { $in: ['forest', 'travel'] } });
        return { option: async () => [{ _id: 'forest', count: 3 }] };
      },
      findOne(filter) {
        latestCalls++;
        assert.equal(filter.status, 'published'); assert.equal(filter.contentRating, 'general');
        return chain(filter.categories === 'forest' ? { title: 'Newest', thumbnail: { url: 'https://new.test/a.jpg' } } : null);
      },
    },
  }, { getOrLoad: (_key, load) => load() }, { queryTimeoutMs: 1500, providerHosts: {} });
  const result = await catalog.categories({ limit: 2 });
  assert.equal(result.categories[0].thumbnail.url, 'https://new.test/a.jpg');
  assert.equal(result.categories[0].thumbnail.alt, 'Newest');
  assert.equal(result.categories[0].videoCount, 3);
  assert.deepEqual(result.categories[1].thumbnail, {});
  assert.equal(result.categories[1].videoCount, 0);
  assert.equal(result.nextCursor, 'travel');
  assert.equal(latestCalls, 2);
});

test('empty categories do not query video collection', async () => {
  const chain = { select() { return this; }, sort() { return this; }, limit() { return this; }, lean() { return this; }, maxTimeMS: async () => [] };
  const catalog = makeCatalog({ Category: { find: () => chain }, Video: {} },
    { getOrLoad: (_key, load) => load() }, { providerHosts: {}, queryTimeoutMs: 1500 });
  assert.deepEqual(await catalog.categories(), { categories: [], nextCursor: null });
});

test('numbered category listing filters published videos, clamps pages and preserves cursor mode', async () => {
  const category = { _id: 'category', slug: 'forest', name: 'Forest', status: 'active', contentRating: 'general' };
  let skip, listingFilter, limits;
  const rows = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', slug: 'walk', title: 'Walk', publishedAt: new Date('2026-01-01'), metrics: {}, tags: [] }];
  function chain(value) { return {
    select() { return this; }, sort(value) { assert.deepEqual(value, { publishedAt: -1, _id: -1 }); return this; },
    skip(n) { skip = n; return this; }, limit(n) { limits = n; return this; }, lean() { return this; },
    maxTimeMS: async () => value,
  }; }
  const catalog = makeCatalog({ Category: { findOne: () => chain(category) }, Video: {
    countDocuments(filter) { assert.deepEqual(filter, { categories: 'forest', status: 'published', contentRating: 'general' }); return chain(30); },
    find(filter) { listingFilter = filter; return chain(rows); },
  } }, { getOrLoad: (_key, load) => load() }, { providerHosts: {}, queryTimeoutMs: 1500, siteOrigin: 'https://site.test' });
  const result = await catalog.category('forest', { page: 999, limit: 25 });
  assert.equal(skip, 25); assert.equal(limits, 25);
  assert.equal(listingFilter.contentRating, 'general');
  assert.deepEqual(result.pagination, { currentPage: 2, pageCount: 2, totalVideos: 30, pageSize: 25, hasMoreViaCursor: false });
  assert.equal(result.nextCursor, null);
  const cursorResult = await catalog.category('forest', { limit: 25 });
  assert.equal(cursorResult.pagination, undefined);
  assert.equal(limits, 26);
});
