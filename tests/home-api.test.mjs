import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHome, getHome, HomeCollectionNotFound } from '../src/lib/home-api.ts';
const sample = () => ({ seo: { title: 'DB title', metaDescription: 'DB description', indexAllowed: true }, contentRating: 'general',
  selectedSection: null, emptyMessage: 'Nothing yet', sections: [{ key: 'custom', title: 'Database heading', badgeText: 'Database badge', seeMoreLabel: 'Browse',
    seeMoreUrl: '/?section=custom', paginate: true, pagination: { currentPage: 1, pageCount: 2 },
    videos: [{ id: 'a', slug: 'forest', title: 'Forest', durationSeconds: 161, quality: 'hd', categoryName: 'Nature', metrics: { views: 1200, likes: 0, dislikes: 0 }, thumbnail: {} }] }] });
test('home maps database headings, badges, counts and card data without dummy values', () => {
  const result = parseHome(sample());
  assert.equal(result.seo.title, 'DB title'); assert.equal(result.sections[0].title, 'Database heading');
  assert.equal(result.sections[0].badgeText, 'Database badge'); assert.equal(result.sections[0].films[0].genre, 'Nature');
  assert.equal(result.sections[0].films[0].rating, null); assert.equal(result.sections[0].films[0].duration, 161);
  const malformed = sample(); malformed.sections[0].seeMoreUrl = 'https://malicious.test'; assert.throws(() => parseHome(malformed));
});
test('home fetch sends selected collection/page and distinguishes missing collection from outages', async () => {
  const oldFetch = globalThis.fetch, oldOrigin = process.env.CATALOG_API_ORIGIN;
  process.env.CATALOG_API_ORIGIN = 'http://127.0.0.1:3000';
  try {
    globalThis.fetch = async url => {
      assert.equal(url.pathname, '/api/home'); assert.equal(url.searchParams.get('section'), 'custom'); assert.equal(url.searchParams.get('page'), '2');
      return { ok: true, json: async () => sample() };
    };
    assert.equal((await getHome('custom', 2)).sections.length, 1);
    globalThis.fetch = async () => ({ ok: false, status: 404 }); await assert.rejects(getHome('custom'), HomeCollectionNotFound);
    globalThis.fetch = async () => ({ ok: false, status: 503 }); await assert.rejects(getHome(), /503/);
  } finally { globalThis.fetch = oldFetch; if (oldOrigin === undefined) delete process.env.CATALOG_API_ORIGIN; else process.env.CATALOG_API_ORIGIN = oldOrigin; }
});
