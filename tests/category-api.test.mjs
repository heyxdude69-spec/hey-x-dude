import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCategory, getCategoryCards, getCategoryBatch, parseCategoryBatch } from '../src/lib/category-api.ts';

test('category mapping keeps database slug/name/count and rejects unsafe images', () => {
  const category = { slug: 'forest-walks', name: 'Forest Walks', videoCount: 0, thumbnail: { url: 'javascript:alert(1)' } };
  assert.deepEqual(mapCategory(category), { slug: 'forest-walks', name: 'Forest Walks', videoCount: 0,
    thumbnail: { url: undefined, alt: 'Forest Walks' } });
  assert.throws(() => mapCategory({ ...category, videoCount: -1 }));
  assert.equal(mapCategory({ ...category, thumbnail: { url: 'https://images.test/latest.jpg', alt: 'Latest video' } }).thumbnail.alt, 'Latest video');
});

test('directory fetch consumes API cursors and reports outages without dummy data', async () => {
  const oldFetch = globalThis.fetch;
  const oldOrigin = process.env.CATALOG_API_ORIGIN;
  const oldRating = process.env.CATALOG_CONTENT_RATING;
  process.env.CATALOG_API_ORIGIN = 'http://127.0.0.1:3000';
  process.env.CATALOG_CONTENT_RATING = 'general';
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.searchParams.get('rating'), 'general');
      assert.equal(options.cache, 'force-cache');
      assert.equal(options.next.revalidate, 120);
      calls++;
      if (calls === 2) assert.equal(url.searchParams.get('cursor'), 'forest');
      return { ok: true, json: async () => ({ categories: [{ slug: calls === 1 ? 'forest' : 'travel', name: 'Collection', videoCount: 2 }],
        nextCursor: calls === 1 ? 'forest' : null }) };
    };
    assert.deepEqual((await getCategoryCards()).map(row => row.slug), ['forest', 'travel']);
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(getCategoryCards(), /503/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ categories: [], nextCursor: 'forest' }) });
    await assert.rejects(getCategoryCards(), /cursor/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldOrigin === undefined) delete process.env.CATALOG_API_ORIGIN; else process.env.CATALOG_API_ORIGIN = oldOrigin;
    if (oldRating === undefined) delete process.env.CATALOG_CONTENT_RATING; else process.env.CATALOG_CONTENT_RATING = oldRating;
  }
});


test('category batches fetch exactly one page and reject invalid/repeated cursors', async () => {
  const oldFetch = globalThis.fetch, oldOrigin = process.env.CATALOG_API_ORIGIN, oldRating = process.env.CATALOG_CONTENT_RATING;
  process.env.CATALOG_API_ORIGIN = 'https://catalog.test'; process.env.CATALOG_CONTENT_RATING = 'general';
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++; assert.equal(url.searchParams.get('limit'), '48'); assert.equal(url.searchParams.get('cursor'), 'forest');
      assert.equal(options.next.revalidate, 120);
      return { ok: true, json: async () => ({ categories: [{ slug: 'travel', name: 'Travel', videoCount: 0 }], nextCursor: 'travel' }) };
    };
    assert.equal((await getCategoryBatch('forest')).nextCursor, 'travel'); assert.equal(calls, 1);
    await assert.rejects(getCategoryBatch('../bad'));
    assert.equal(calls, 1);
    assert.throws(() => parseCategoryBatch({ categories: [], nextCursor: 'forest' }, 'forest'));
    assert.deepEqual(parseCategoryBatch({ categories: [], nextCursor: null }), { categories: [], nextCursor: null });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldOrigin === undefined) delete process.env.CATALOG_API_ORIGIN; else process.env.CATALOG_API_ORIGIN = oldOrigin;
    if (oldRating === undefined) delete process.env.CATALOG_CONTENT_RATING; else process.env.CATALOG_CONTENT_RATING = oldRating;
  }
});
