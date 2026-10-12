import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCategory, getCategoryCards } from '../src/lib/category-api.ts';

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
      assert.equal(options.cache, 'no-store');
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
