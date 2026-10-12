import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCategoryPage, normalizeCategoryPage, getCategoryVideos, CategoryNotFound } from '../src/lib/category-videos-api.ts';

const payload = () => ({ category: { slug: 'nature', name: 'Nature', description: 'Outdoor scenes', seo: { indexAllowed: true } },
  videos: [{ id: 'abc', slug: 'forest-walk', title: 'Forest Walk', thumbnail: { url: 'https://images.test/poster.jpg', alt: 'Forest path' },
    durationSeconds: 161, quality: 'fullhd', metrics: { views: 1250, likes: 3, dislikes: 1 } }],
  pagination: { currentPage: 2, pageCount: 4, totalVideos: 90 } });

test('category cards map Mongo metrics, durations and quality without fabricated ratings', () => {
  const result = parseCategoryPage(payload());
  assert.equal(result.films[0].rating, 75);
  assert.equal(result.films[0].duration, 161);
  assert.equal(result.films[0].views, '1.3K');
  assert.equal(result.films[0].quality, 'Full HD');
  assert.equal(result.films[0].genre, 'Nature');
  assert.equal(result.films[0].thumbnailAlt, 'Forest path');
  const missing = payload();
  missing.videos[0].metrics = { views: 0, likes: 0, dislikes: 0 };
  missing.videos[0].thumbnail = {};
  missing.videos[0].durationSeconds = null;
  missing.videos[0].quality = null;
  const card = parseCategoryPage(missing).films[0];
  assert.equal(card.rating, null);
  assert.equal(card.duration, null);
  assert.equal(card.quality, '—');
  assert.equal(card.thumbnail, '/thumbnails/scene-1.svg');
  assert.throws(() => parseCategoryPage({ ...payload(), pagination: { currentPage: 5, pageCount: 4, totalVideos: 90 } }));
});

test('page normalization bounds numbered queries', () => {
  assert.equal(normalizeCategoryPage('2'), 2);
  for (const value of ['0', '-2', 'Infinity', '1.5', '1001', 'garbage']) assert.equal(normalizeCategoryPage(value), 1);
});

test('category fetch distinguishes 404 from outages and checks response slug', async () => {
  const oldFetch = globalThis.fetch, oldOrigin = process.env.CATALOG_API_ORIGIN;
  process.env.CATALOG_API_ORIGIN = 'http://127.0.0.1:3000';
  try {
    globalThis.fetch = async url => {
      assert.equal(url.pathname, '/api/categories/nature/videos');
      assert.equal(url.searchParams.get('page'), '2');
      assert.equal(url.searchParams.get('limit'), '25');
      return { ok: true, status: 200, json: async () => payload() };
    };
    assert.equal((await getCategoryVideos('nature', 2)).category.name, 'Nature');
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(getCategoryVideos('nature', 1), CategoryNotFound);
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(getCategoryVideos('nature', 1), /503/);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload() });
    await assert.rejects(getCategoryVideos('travel', 1), /mismatch/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldOrigin === undefined) delete process.env.CATALOG_API_ORIGIN; else process.env.CATALOG_API_ORIGIN = oldOrigin;
  }
});
