import { mkdir, open, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { escapeHtml } from './render.mjs';
import { usableSource } from './catalog.mjs';

export async function buildSitemaps(database, config, directory = 'public/sitemaps') {
  const publicOrigin = config.publicSiteOrigin || config.siteOrigin;
  await mkdir(directory, { recursive: true });
  const generation = `${Date.now()}-${randomUUID().slice(0, 8)}`, chunks = [];
  let file, count = 0, categoryCount = 0, directoryCount = 0, pageCount = 0, fileEntries = 0, fileBytes = 0;
  const start = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
  async function finish() { if (file) { await file.write('</urlset>'); await file.close(); file = null; } }
  async function write(video, source) {
    const loc = `${publicOrigin}/${video.slug}`;
    const entry = `<url><loc>${escapeHtml(loc)}</loc><lastmod>${new Date(video.updatedAt).toISOString()}</lastmod><video:video>` +
      `<video:thumbnail_loc>${escapeHtml(video.thumbnail.url)}</video:thumbnail_loc><video:title>${escapeHtml(video.title)}</video:title>` +
      `<video:description>${escapeHtml(video.description)}</video:description><video:publication_date>${new Date(video.uploadDate).toISOString()}</video:publication_date>` +
      (source.kind === 'embed' ? `<video:player_loc>${escapeHtml(source.embedUrl)}</video:player_loc>` : `<video:content_loc>${escapeHtml(source.contentUrl)}</video:content_loc>`) +
      (video.durationSeconds ? `<video:duration>${video.durationSeconds}</video:duration>` : '') +
      `<video:family_friendly>${video.contentRating === 'adult' ? 'no' : 'yes'}</video:family_friendly></video:video></url>\n`;
    await append(entry); count++;
  }
  async function append(entry) {
    const entryBytes = Buffer.byteLength(entry);
    if (!file || fileEntries >= 5000 || fileBytes + entryBytes > 45 * 1024 * 1024) {
      await finish();
      if (chunks.length >= 50000) throw new Error('Sitemap index limit reached; split this catalog into separately submitted indexes');
      const filename = `videos-${generation}-${chunks.length + 1}.xml`;
      file = await open(`${directory}/${filename}`, 'wx'); chunks.push(filename); await file.write(start);
      fileEntries = 0; fileBytes = Buffer.byteLength(start);
    }
    await file.write(entry); fileEntries++; fileBytes += entryBytes;
  }
  try {
    const cursor = database.Video.find({ status: 'published', 'seo.indexAllowed': true }).select('slug title description thumbnail uploadDate durationSeconds contentRating updatedAt')
      .sort({ _id: 1 }).lean().cursor({ batchSize: 100 });
    let batch = [];
    async function flush() {
      if (!batch.length) return;
      const sources = await database.VideoSource.find({ videoId: { $in: batch.map(video => video._id) }, enabled: true, status: 'ready' })
        .sort({ priority: 1, _id: 1 }).lean().maxTimeMS(config.queryTimeoutMs);
      const selected = new Map();
      for (const source of sources) if (usableSource(source, config) && !selected.has(String(source.videoId))) selected.set(String(source.videoId), source);
      for (const video of batch) {
        pageCount++;
        if (selected.has(String(video._id)) && video.uploadDate && video.thumbnail?.url) await write(video, selected.get(String(video._id)));
      }
      batch = [];
    }
    try { for await (const video of cursor) { batch.push(video); if (batch.length === 100) await flush(); } await flush(); }
    finally { await cursor.close(); }
    const categories = database.Category.find({ status: 'active', 'seo.indexAllowed': true })
      .select('slug contentRating updatedAt').sort({ _id: 1 }).lean().cursor({ batchSize: 100 });
    try {
      for await (const category of categories) {
        // Background-only existence check, bounded by the category/video listing index.
        const hasVideos = await database.Video.exists({ categories: category.slug, status: 'published', contentRating: category.contentRating }).maxTimeMS(config.queryTimeoutMs);
        if (!hasVideos) continue;
        await append(`<url><loc>${escapeHtml(`${publicOrigin}/categories/${category.slug}`)}</loc><lastmod>${new Date(category.updatedAt).toISOString()}</lastmod></url>\n`);
        categoryCount++;
      }
    } finally { await categories.close(); }
    if (config.sitePages.categories.seo.indexAllowed && await database.Category.exists({ status: 'active', contentRating: 'general' }).maxTimeMS(config.queryTimeoutMs)) {
      await append(`<url><loc>${escapeHtml(`${publicOrigin}/categories`)}</loc></url>\n`);
      directoryCount++;
    }
    await finish();
    const temporaryIndex = `${directory}/index-${generation}.tmp`;
    const index = await open(temporaryIndex, 'wx');
    await index.write('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    for (const filename of chunks) await index.write(`<sitemap><loc>${publicOrigin}/sitemaps/${filename}</loc></sitemap>\n`);
    await index.write('</sitemapindex>'); await index.close();
    await rename(temporaryIndex, `${directory}/index.xml`);
    return { inspectedPublishedPages: pageCount, includedPlayableVideos: count, includedCategories: categoryCount, includedDirectoryPages: directoryCount, sitemapFiles: chunks.length };
  } finally { await finish(); }
}
