import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readConfig } from '../src/config.mjs';
import { connectDatabase, setupDatabase } from '../src/models.mjs';
import { CatalogCache } from '../src/cache.mjs';
import { createApp } from '../src/app.mjs';
import { buildSitemaps } from '../src/sitemap.mjs';

test('live MongoDB: validators, indexes, slug page, sources, recommendations, cache invalidation, pagination and sitemap', async t => {
  const databaseName = `video_catalog_test_${randomBytes(8).toString('hex')}`;
  const config = readConfig({ mode: 'test', redisUrl: '', adminToken: randomBytes(32).toString('hex'), siteOrigin: 'https://catalog.test',
    providerHosts: { voe: ['player.test'], filemoon: ['mirror.test'] }, rateLimit: 1000 });
  let database;
  try { database = await connectDatabase(config, databaseName); }
  catch (error) {
    if (process.env.REQUIRE_INTEGRATION === '1') throw error;
    t.skip('Local MongoDB unavailable; set REQUIRE_INTEGRATION=1 to make absence a failure'); return;
  }
  const cache = new CatalogCache(config), server = createApp({ database, cache, config, logRequests: false }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const tempDirectory = await mkdtemp(join(tmpdir(), 'video-catalog-sitemap-test-'));
  const request = async (path, body, method = 'POST', authorized = true) => {
    const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${config.adminToken}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  try {
    await setupDatabase(database); await setupDatabase(database);
    const indexes = await database.VideoSource.collection.indexes();
    assert.ok(indexes.some(index => index.name === 'bounded_source_slots' && index.unique));
    await assert.rejects(database.Video.collection.insertOne({ slug: 'invalid', title: 'Invalid', status: 'published', tags: [], contentRating: 'general' }), error => error.code === 121);
    assert.equal((await request('/api/admin/videos', { slug: 'unauthorized', title: 'No' }, 'POST', false)).status, 401);
    const nature = await request('/api/admin/categories', { slug: 'nature', name: 'Nature', h1: 'Nature Videos', language: 'en-US', bodyText: 'Forests and outdoor scenery.', description: 'Outdoor scenes',
      seo: { title: 'Nature videos', metaDescription: 'Browse outdoor scenes' }, status: 'active' });
    assert.equal(nature.status, 201);
    assert.equal((await request('/api/admin/categories', { slug: 'nature', name: 'Duplicate' })).status, 409);
    await request('/api/admin/categories', { slug: 'private-category', name: 'Private' });
    await request('/api/admin/categories', { slug: 'adult-category', name: 'Restricted', description: 'Restricted classification', contentRating: 'adult',
      seo: { title: 'Restricted', metaDescription: 'Restricted classification' }, status: 'active' });
    const first = await request('/api/admin/videos', { slug: 'main-video', title: 'Main video', h1: 'Main video', description: 'A detailed video description',
      seo: { title: 'Main video watch page', metaDescription: 'Main description' }, thumbnail: { url: 'https://media.test/main.jpg' },
      uploadDate: '2026-01-01T00:00:00Z', contentRating: 'general', tags: ['nature', 'garden'], categories: ['nature'] });
    assert.equal(first.status, 201); const id = first.data.video._id;
    const adminList = await request('/api/admin/videos?status=draft', undefined, 'GET');
    assert.equal(adminList.status, 200); assert.equal(adminList.data.videos[0]._id, id);
    assert.equal((await request(`/api/admin/videos/${id}`, { status: 'published' }, 'PATCH')).status, 409);
    const primary = await request(`/api/admin/videos/${id}/sources`, { provider: 'voe', externalVideoId: 'primary', kind: 'embed', embedUrl: 'https://player.test/embed/primary', priority: 10, status: 'ready' });
    const mirror = await request(`/api/admin/videos/${id}/sources`, { provider: 'filemoon', externalVideoId: 'mirror', kind: 'embed', embedUrl: 'https://mirror.test/embed/mirror', priority: 20, status: 'ready' });
    assert.equal(primary.status, 201); assert.equal(mirror.status, 201);
    assert.equal((await request(`/api/admin/videos/${id}`, { status: 'published', categories: ['missing-category'] }, 'PATCH')).status, 409);
    assert.equal((await request(`/api/admin/videos/${id}`, { status: 'published', categories: ['adult-category'] }, 'PATCH')).status, 409);
    const nativeSource = await database.VideoSource.findById(primary.data.source._id).lean();
    for (const slot of [0.5, 20]) {
      const { _id, ...copy } = nativeSource;
      await assert.rejects(database.VideoSource.collection.insertOne({ ...copy, externalVideoId: `invalid-slot-${slot}`, slot }), error => error.code === 121);
    }
    assert.equal((await request(`/api/admin/videos/${id}`, { status: 'published' }, 'PATCH')).status, 200);
    // Create candidate records with known test-only facts; no remote media is contacted.
    for (const [slug, tags, rating] of [['best-match', ['nature', 'garden'], 'general'], ['single-match', ['nature'], 'general'], ['wrong-rating', ['nature', 'garden'], 'adult']]) {
      const video = await database.Video.create({ slug, title: slug, h1: slug, description: 'Candidate', seo: { title: slug, metaDescription: 'Candidate' },
        thumbnail: { url: 'https://media.test/thumb.jpg' }, tags, categories: ['nature'], contentRating: rating, uploadDate: new Date('2026-01-01'), publishedAt: new Date(), status: 'published' });
      await database.VideoSource.create({ videoId: video._id, provider: 'voe', externalVideoId: slug, slot: 0, kind: 'embed', embedUrl: `https://player.test/embed/${slug}`, priority: 10, status: 'ready' });
    }
    await cache.invalidate();
    let page = await (await fetch(origin + '/api/videos/main-video')).json();
    assert.equal(page.selectedSourceId, primary.data.source._id);
    assert.deepEqual(page.recommendations.map(video => video.slug), ['best-match', 'single-match']);
    assert.equal(page.video.importReference, undefined);
    assert.equal(page.categories[0].slug, 'nature');
    const directory = await (await fetch(origin + '/api/categories')).json();
    assert.deepEqual(directory.categories.map(category => category.slug), ['nature']);
    assert.equal(directory.seo.canonicalUrl, 'https://catalog.test/categories/');
    assert.equal(directory.categories[0].bodyText, undefined);
    assert.equal((await fetch(origin + '/category/private-category/')).status, 404);
    const categoryListing = await (await fetch(origin + '/api/categories/nature/videos?limit=1')).json();
    assert.equal(categoryListing.videos.length, 1); assert.ok(categoryListing.nextCursor);
    assert.equal(categoryListing.category.h1, 'Nature Videos'); assert.equal(categoryListing.category.language, 'en-US');
    assert.equal(categoryListing.category.bodyText, 'Forests and outdoor scenery.');
    assert.equal(categoryListing.seo.structuredData['@graph'].find(n => n['@type'] === 'ItemList').numberOfItems, 1);
    const nextCategoryListing = await (await fetch(origin + `/api/categories/nature/videos?limit=1&cursor=${categoryListing.nextCursor}`)).json();
    assert.notEqual(nextCategoryListing.videos[0].id, categoryListing.videos[0].id);
    assert.ok((await (await fetch(origin + '/categories/')).text()).includes('href="/category/nature/"'));
    const categoryHtml = await (await fetch(origin + '/category/nature/')).text();
    assert.ok(categoryHtml.includes('<h1>Nature Videos</h1>')); assert.ok(categoryHtml.includes('Forests and outdoor scenery.'));
    assert.ok(categoryHtml.includes('CollectionPage')); assert.ok(categoryHtml.includes('BreadcrumbList')); assert.ok(categoryHtml.includes('twitter:description'));
    assert.equal(nextCategoryListing.seo.indexable, false);
    assert.ok(nextCategoryListing.seo.canonicalUrl.includes(`cursor=${categoryListing.nextCursor}`));
    assert.equal((await request(`/api/admin/categories/${nature.data.category._id}`, { language: 'invalid_language' }, 'PATCH')).status, 400);
    await assert.rejects(database.Category.collection.updateOne({ _id: new database.connection.base.Types.ObjectId(nature.data.category._id) }, { $set: { bodyText: 'x'.repeat(30001) } }), error => error.code === 121);
    assert.equal((await fetch(origin + '/api/categories/nature/videos?limit=100')).status, 400);
    const firstLoads = cache.stats.loads;
    await fetch(origin + '/api/videos/main-video'); assert.equal(cache.stats.loads, firstLoads);
    assert.equal((await request(`/api/admin/sources/${primary.data.source._id}`, { enabled: false }, 'PATCH')).status, 200);
    page = await (await fetch(origin + '/api/videos/main-video')).json(); assert.equal(page.selectedSourceId, mirror.data.source._id);
    assert.equal(page.seo.structuredData['@graph'].find(n => n['@type'] === 'VideoObject').embedUrl, 'https://mirror.test/embed/mirror');
    const html = await (await fetch(origin + '/videos/main-video/')).text();
    assert.ok(html.includes('<h1>Main video</h1>')); assert.ok(html.includes('application/ld+json')); assert.ok(html.includes('https://mirror.test/embed/mirror'));
    assert.equal((await request('/api/admin/videos', { slug: 'main-video', title: 'Duplicate' })).status, 409);
    assert.equal((await request(`/api/admin/videos/${id}`, { slug: 'changed' }, 'PATCH')).status, 400);
    assert.equal((await request(`/api/admin/videos/${id}/sources`, { provider: 'voe', externalVideoId: 'unsafe', kind: 'embed', embedUrl: 'https://unapproved.test/embed', status: 'ready' })).status, 400);
    const firstList = await (await fetch(origin + '/api/videos?limit=1')).json();
    const secondList = await (await fetch(origin + `/api/videos?limit=1&cursor=${firstList.nextCursor}`)).json();
    assert.notEqual(firstList.videos[0].id, secondList.videos[0].id);
    const maps = await buildSitemaps(database, config, tempDirectory); assert.equal(maps.includedPlayableVideos, 4);
    assert.equal(maps.includedCategories, 1);
    assert.equal(maps.includedDirectoryPages, 1);
    const index = await readFile(join(tempDirectory, 'index.xml'), 'utf8'); assert.ok(index.includes('sitemapindex'));
    assert.equal((await request(`/api/admin/sources/${mirror.data.source._id}`, { availability: 'unavailable' }, 'PATCH')).status, 200);
    const unavailable = await fetch(origin + '/videos/main-video/'); assert.equal(unavailable.status, 503); assert.equal(unavailable.headers.get('x-robots-tag'), 'noindex');
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    assert.equal((await request(`/api/admin/sources/${mirror.data.source._id}`, undefined, 'DELETE')).status, 200);
    assert.equal(await database.VideoSource.exists({ _id: mirror.data.source._id }), null);
    const renamedCategory = await request(`/api/admin/categories/${nature.data.category._id}`, { name: 'Outdoor nature' }, 'PATCH');
    assert.equal(renamedCategory.status, 200, JSON.stringify(renamedCategory.data));
    assert.equal((await (await fetch(origin + '/api/categories')).json()).categories[0].name, 'Outdoor nature');
    assert.equal((await request(`/api/admin/categories/${nature.data.category._id}`, { slug: 'changed' }, 'PATCH')).status, 400);
    assert.equal((await request(`/api/admin/categories/${nature.data.category._id}`, { status: 'archived' }, 'PATCH')).status, 200);
    assert.equal((await fetch(origin + '/category/nature/')).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve)); await cache.close();
    // Only the fresh, randomly named database created by this test is eligible for deletion.
    assert.equal(database.connection.name, databaseName); assert.match(databaseName, /^video_catalog_test_[a-f0-9]{16}$/);
    await database.connection.dropDatabase(); await database.connection.close();
    const resolvedTemp = resolve(tempDirectory), expectedParent = resolve(tmpdir());
    assert.equal(resolve(resolvedTemp, '..'), expectedParent); assert.ok(resolvedTemp.includes('video-catalog-sitemap-test-'));
    await rm(resolvedTemp, { recursive: true, force: true });
  }
});
