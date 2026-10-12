import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoPage, safeStructuredJson } from '../src/lib/video-api.ts';
const sample = () => ({ video: { _id: 'one', slug: 'forest-walk', title: 'Forest Walk', h1: 'Forest Trail', description: 'A walk',
  bodyText: 'Along a trail', language: 'en', categories: ['nature'], tags: ['forest'], uploadDate: '2026-10-05T00:00:00Z',
  thumbnail: { url: 'https://images.test/poster.jpg' }, media: { quality: 'hd' }, metrics: { views: 5, likes: 1, dislikes: 1 },
  seo: { title: 'Forest Walk Video', metaDescription: 'Watch a forest walk', indexAllowed: true }, contentRating: 'general' },
  categories: [{ slug: 'nature', name: 'Nature' }], sources: [{ id: 'provider', provider: 'voe', kind: 'embed', url: 'https://voe.sx/e/example' }],
  selectedSourceId: 'provider', recommendations: [] });
test('watch SEO, links and exploration point to a category-independent root slug', () => {
  const data = parseVideoPage(sample(), 'https://site.test');
  assert.equal(data.seo.canonical, 'https://site.test/forest-walk');
  assert.equal(data.h1, 'Forest Trail'); assert.equal(data.exploreUrl, '/categories/nature');
  assert.equal(data.card.rating, 50); assert.equal(data.seo.index, true);
  const schema = data.structuredData.find(v => v['@type'] === 'VideoObject');
  assert.equal(schema.url, data.seo.canonical); assert.equal(schema.embedUrl, 'https://voe.sx/e/example');
  assert.equal(schema.contentUrl, undefined);
  assert.ok(!safeStructuredJson({ text: '</script><script>bad()</script>' }).includes('</script>'));
});
test('unavailable providers preserve metadata but block indexing and fabricated video schema', () => {
  const input = sample(); input.sources = [];
  const data = parseVideoPage(input, 'https://site.test');
  assert.equal(data.seo.index, false); assert.equal(data.structuredData.length, 1);
});
test('direct sources use contentUrl; invalid or oversized recommendation responses fail safely', () => {
  const input = sample(); input.sources[0].kind = 'direct';
  assert.equal(parseVideoPage(input, 'https://site.test').structuredData[1].contentUrl, input.sources[0].url);
  input.recommendations = Array.from({ length: 17 }, () => ({}));
  assert.throws(() => parseVideoPage(input, 'https://site.test'));
});
