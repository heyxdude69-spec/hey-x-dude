import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNavigation, getNavigationCategories } from '../src/lib/navigation-api.ts';

test('navigation preserves database names and slugs and rejects unsafe or duplicate links', () => {
  const categories = [{ slug: 'forest-walk', name: 'Forest Walk' }, { slug: 'nature', name: 'Nature' }];
  assert.deepEqual(parseNavigation({ categories }), categories);
  assert.deepEqual(parseNavigation({ categories: [] }), []);
  assert.throws(() => parseNavigation({ categories: [{ slug: '../admin', name: 'Bad' }] }));
  assert.throws(() => parseNavigation({ categories: [categories[0], categories[0]] }));
});


test('shared navigation has a bounded cache and never forwards visitor cookies', async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.CATALOG_API_ORIGIN;
  const originalRating = process.env.CATALOG_CONTENT_RATING;
  process.env.CATALOG_API_ORIGIN = 'https://catalog.test';
  process.env.CATALOG_CONTENT_RATING = 'general';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.pathname, '/api/navigation');
      assert.equal(url.searchParams.get('rating'), 'general');
      assert.equal(options.cache, 'force-cache');
      assert.equal(options.next.revalidate, 300);
      assert.equal(options.headers?.Cookie, undefined);
      assert.equal(options.headers?.['X-Visitor-Id'], undefined);
      return { ok: true, json: async () => ({ categories: [] }) };
    };
    assert.deepEqual(await getNavigationCategories(), []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.CATALOG_API_ORIGIN; else process.env.CATALOG_API_ORIGIN = originalOrigin;
    if (originalRating === undefined) delete process.env.CATALOG_CONTENT_RATING; else process.env.CATALOG_CONTENT_RATING = originalRating;
  }
});
