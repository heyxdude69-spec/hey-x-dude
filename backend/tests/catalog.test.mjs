import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRecommendations, orderSources, encodeCursor, decodeCursor } from '../src/catalog.mjs';
import { reportToDraft, durationToSeconds } from '../src/importer.mjs';
import { safeJson, videoStructuredData } from '../src/render.mjs';
import { CatalogCache, RequestLimiter } from '../src/cache.mjs';
import { modelsFor } from '../src/models.mjs';
import mongoose from 'mongoose';

const config = { providerHosts: { voe: ['player.test'] }, cacheTtl: 5, localCacheTtl: 5, localCacheEntries: 2, rateLimit: 10 };
test('source priority respects disabled, unavailable and unapproved sources', () => {
  const base = { enabled: true, status: 'ready', availability: 'unknown', kind: 'embed', provider: 'voe', embedUrl: 'https://player.test/embed/a' };
  const ordered = orderSources([
    { ...base, _id: 'a', priority: 1, enabled: false }, { ...base, _id: 'b', priority: 2, availability: 'unavailable' },
    { ...base, _id: 'c', priority: 3, embedUrl: 'https://unapproved.test/embed' },
    { ...base, _id: 'd', priority: 20 }, { ...base, _id: 'e', priority: 10 },
  ], config);
  assert.deepEqual(ordered.map(s => s._id), ['e', 'd']);
});
test('recommendations use tag overlap, exclude self, drafts, different ratings and duplicates', () => {
  const video = { _id: 'self', tags: ['nature', 'garden'], contentRating: 'general' };
  const candidate = (_id, tags, overrides = {}) => ({ _id, tags, status: 'published', contentRating: 'general', publishedAt: '2026-01-01', ...overrides });
  const ranked = rankRecommendations([candidate('self', ['nature']), candidate('one', ['nature']), candidate('two', ['nature', 'garden']),
    candidate('two', ['nature']), candidate('draft', ['nature'], { status: 'draft' }),
    candidate('adult', ['nature'], { contentRating: 'adult' }), candidate('other', ['tutorial'])], video);
  assert.deepEqual(ranked.map(v => v._id), ['two', 'one']);
});
test('pagination rejects malformed cursors', () => {
  const data = { _id: new mongoose.Types.ObjectId(), publishedAt: new Date('2026-10-04T00:00:00Z') };
  assert.equal(String(decodeCursor(encodeCursor(data))._id), String(data._id));
  assert.throws(() => decodeCursor('not-valid-json'));
});
test('cache coalesces misses, isolates returned objects, bounds memory and invalidates', async () => {
  const cache = new CatalogCache(config); let calls = 0;
  const load = async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { tags: ['demo'] }; };
  const results = await Promise.all(Array.from({ length: 10 }, () => cache.getOrLoad('page', load)));
  assert.equal(calls, 1); results[0].tags.push('modified');
  assert.deepEqual((await cache.getOrLoad('page', load)).tags, ['demo']);
  await cache.getOrLoad('second', load); await cache.getOrLoad('third', load);
  assert.ok(cache.entries.size <= 2);
  await cache.invalidate(); await cache.getOrLoad('page', load); assert.equal(calls, 4);
});
test('failed cache loads are not retained', async () => {
  const cache = new CatalogCache(config); let calls = 0;
  await assert.rejects(cache.getOrLoad('broken', () => { throw new Error('failure'); }));
  await cache.getOrLoad('broken', () => { calls++; return {}; }); assert.equal(calls, 1);
});
test('memory rate limiter rejects requests beyond its window budget', async () => {
  const limiter = new RequestLimiter(new CatalogCache(config), config);
  for (let i = 0; i < 10; i++) assert.equal(await limiter.allow('127.0.0.1'), true);
  assert.equal(await limiter.allow('127.0.0.1'), false);
});
test('import reads microdata but leaves source URLs disabled and candidate pages unverified', () => {
  const report = { page: { final_url: 'https://reference.test/sample-video/' }, seo: { title: 'Sample', headings: { h1: ['Sample'] }, meta_description: ['Description'],
    all_meta_tags: [{ property: 'article:tag', content: 'Nature' }], microdata: [{ itemprop: 'duration', content: 'P0DT0H0M44S' },
      { itemprop: 'uploadDate', content: '2026-01-01T00:00:00Z' }, { itemprop: 'contentUrl', content: 'https://media.test/movie.mp4' }] },
    links: [{ href: 'https://reference.test/related-video/' }, { href: 'https://reference.test/category/nature/' }, { href: 'https://reference.test/about-us/' }],
    iframes: [{ src: 'https://player.test/embed/abc' }] };
  const draft = reportToDraft(report);
  assert.equal(draft.video.status, 'draft'); assert.equal(draft.video.durationSeconds, 44);
  assert.deepEqual(draft.video.tags, ['nature']); assert.equal(draft.sources.length, 2);
  assert.ok(draft.sources.every(source => !source.enabled && source.status === 'pending'));
  assert.equal(draft.linkCandidates.length, 1); assert.equal(draft.linkCandidates[0].tags, null);
  assert.equal(durationToSeconds('not-a-duration'), undefined);
});
test('structured data uses player versus file URL correctly and escapes script termination', () => {
  const page = { video: { title: 'Sample', description: 'Demo', thumbnail: { url: 'https://media.test/thumb.jpg' }, uploadDate: '2026-01-01', contentRating: 'general', canonicalUrl: 'https://site.test/videos/sample/' }, sources: [{ id: 's', kind: 'embed', url: 'https://player.test/embed' }], selectedSourceId: 's' };
  assert.equal(videoStructuredData(page).embedUrl, page.sources[0].url);
  assert.equal(videoStructuredData(page).contentUrl, undefined);
  assert.ok(!safeJson({ title: '</script><script>alert(1)</script>' }).includes('</script>'));
});
test('published metadata and ready source requirements are enforced before DB writes', async () => {
  const connection = mongoose.createConnection(), models = modelsFor(connection);
  await assert.rejects(new models.Video({ slug: 'sample', title: 'Sample', status: 'published' }).validate());
  await assert.rejects(new models.VideoSource({ videoId: new mongoose.Types.ObjectId(), provider: 'voe', externalVideoId: 'abc', slot: 0, kind: 'embed', status: 'ready' }).validate());
  await connection.close();
});
