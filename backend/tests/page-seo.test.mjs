import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.mjs';
import { buildDirectorySeo, buildCategorySeo, buildVideoSeo } from '../src/page-seo.mjs';
import { renderCategories, renderCategory, renderPage, safeJson } from '../src/render.mjs';

const config = readConfig({ mode: 'test', siteOrigin: 'https://catalog.test' });
const category = { slug: 'nature', name: 'Nature', h1: 'Nature Videos', language: 'en-US', bodyText: 'Forests and outdoor scenes.',
  description: 'Explore nature videos.', seo: { title: 'Nature Videos | Catalog', metaDescription: 'Browse nature videos.', indexAllowed: true },
  canonicalUrl: 'https://catalog.test/category/nature/', contentRating: 'general', updatedAt: '2026-01-01T00:00:00Z' };
const card = { title: 'Forest Walk', slug: 'forest-walk', url: '/videos/forest-walk/', tags: ['forest'], thumbnail: {} };
const readGraph = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];

test('directory HTML uses title, description, canonical and bounded collection schema', () => {
  const result = { categories: [{ ...category, url: '/category/nature/' }], nextCursor: null };
  result.seo = buildDirectorySeo(result, config);
  const html = renderCategories(result, config), graph = readGraph(html);
  assert.ok(html.includes(`<title>${result.seo.title}</title>`));
  assert.ok(html.includes('name="description"')); assert.ok(html.includes('name="twitter:title"')); assert.ok(html.includes('property="og:site_name"'));
  assert.ok(html.includes('<h1>Video Categories</h1>')); assert.ok(html.includes('href="/category/nature/"'));
  assert.equal(graph.find(n => n['@type'] === 'CollectionPage').url, result.seo.canonicalUrl);
  assert.deepEqual(graph.find(n => n['@type'] === 'ItemList').itemListElement.map(i => i.url), ['https://catalog.test/category/nature/']);
  assert.equal(graph.find(n => n['@type'] === 'BreadcrumbList').itemListElement.length, 2);
  assert.ok(!graph.some(n => ['Person', 'Article', 'Organization'].includes(n['@type'])));
  const publisherConfig = { ...config, sitePages: { ...config.sitePages, site: { ...config.sitePages.site,
    publisher: { name: 'Example Organization', url: 'https://catalog.test/' }, logo: { url: 'https://media.test/logo.jpg', alt: 'Example logo' } } } };
  const publisher = buildDirectorySeo(result, publisherConfig).structuredData['@graph'].find(n => n['@type'] === 'Organization');
  assert.equal(publisher.logo.caption, 'Example logo'); assert.equal(publisher.logo.alt, undefined);
});

test('category slug renders authored H1/content and only lists the visible videos in structured data', () => {
  const result = { category, videos: [card], nextCursor: 'next-page' }, html = renderCategory(result, {}, config), graph = readGraph(html);
  assert.ok(html.includes('<h1>Nature Videos</h1>')); assert.ok(html.includes(category.bodyText));
  assert.ok(html.includes('rel="next"')); assert.ok(html.includes('max-image-preview:large'));
  const page = graph.find(n => n['@type'] === 'CollectionPage'), list = graph.find(n => n['@type'] === 'ItemList');
  assert.equal(page.mainEntity['@id'], list['@id']); assert.equal(list.numberOfItems, 1);
  assert.equal(list.itemListElement[0].url, 'https://catalog.test/videos/forest-walk/');
  assert.equal(graph.find(n => n['@type'] === 'BreadcrumbList').itemListElement.length, 3);
  assert.ok(!graph.some(n => n['@type'] === 'VideoObject'));
});

test('empty, blocked, paginated and adult filtered views preserve their indexing rules and canonical URLs', () => {
  assert.equal(buildDirectorySeo({ categories: [] }, config).indexable, false);
  assert.equal(buildCategorySeo({ category, videos: [] }, config).robots, 'noindex,follow');
  const next = buildCategorySeo({ category, videos: [card] }, config, { cursor: 'cursor-code', limit: 1 });
  assert.equal(next.canonicalUrl, 'https://catalog.test/category/nature/?cursor=cursor-code&limit=1'); assert.equal(next.indexable, false);
  const numbered = buildCategorySeo({ category, videos: [card], pagination: { currentPage: 2 } }, config, { page: 999, limit: 25 });
  assert.equal(numbered.canonicalUrl, 'https://catalog.test/category/nature/?page=2&limit=25');
  assert.equal(buildCategorySeo({ category: { ...category, seo: { ...category.seo, indexAllowed: false } }, videos: [card] }, config).indexable, false);
  const adult = buildCategorySeo({ category: { ...category, contentRating: 'adult' }, videos: [card] }, config);
  assert.equal(adult.adult, true); assert.equal(adult.breadcrumbs[1].url, 'https://catalog.test/categories/?rating=adult');
  assert.equal(adult.structuredData['@graph'].find(n => n['@type'] === 'CollectionPage').isFamilyFriendly, false);
  assert.equal(buildDirectorySeo({ categories: [{ ...category, url: '/category/nature/' }] }, config, { rating: 'adult' }).indexable, false);
});

test('watch schema follows the selected player, omits seed view statistics and safely escapes HTML/JSON-LD', () => {
  const page = { video: { ...category, title: 'Forest Walk', h1: 'Forest Walk', tags: ['forest'], language: 'en-US',
    thumbnail: { url: 'https://media.test/poster.jpg', alt: 'Forest scene', width: 1280, height: 720 }, uploadDate: '2026-01-01',
    canonicalUrl: 'https://catalog.test/videos/forest-walk/', durationSeconds: 44, metrics: { origin: 'seed', views: 42 },
  }, sources: [{ id: 'primary', provider: 'voe', kind: 'embed', url: 'https://player.test/embed/forest' }], selectedSourceId: 'primary',
    categories: [{ name: 'Nature', url: '/category/nature/' }], recommendations: [] };
  let seo = buildVideoSeo(page, config), video = seo.structuredData['@graph'].find(n => n['@type'] === 'VideoObject');
  assert.equal(video.embedUrl, page.sources[0].url); assert.equal(video.duration, 'PT44S'); assert.equal(video.interactionStatistic, undefined);
  page.video.metrics.origin = 'site'; page.video.description = '</script><script>alert(1)</script>';
  seo = buildVideoSeo(page, config); video = seo.structuredData['@graph'].find(n => n['@type'] === 'VideoObject');
  assert.equal(video.interactionStatistic.userInteractionCount, 42); assert.ok(!safeJson(seo.structuredData).includes('</script>'));
  const html = renderPage(page, config); assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('Views: 42')); assert.ok(html.includes('twitter:image')); assert.equal(readGraph(html).find(n => n['@type'] === 'VideoObject').embedUrl, video.embedUrl);
  page.sources = []; page.selectedSourceId = null;
  assert.equal(buildVideoSeo(page, config).indexable, false);
  assert.ok(!buildVideoSeo(page, config).structuredData['@graph'].some(n => n['@type'] === 'VideoObject'));
});
