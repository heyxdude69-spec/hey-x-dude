import { isoDuration, videoStructuredData, buildDirectorySeo, buildCategorySeo, buildVideoSeo } from './page-seo.mjs';
export { isoDuration, videoStructuredData };
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
function frame(body, options) {
  const metadata = options.seo;
  const { title, description = '', canonical, language = 'en', thumbnail, robots = 'index,follow', schema, adult = false,
    siteName = 'HeyxDude', openGraph, twitter } = metadata ? { ...options, title: metadata.title, description: metadata.description,
    canonical: metadata.canonicalUrl, language: metadata.language, robots: metadata.robots, schema: metadata.structuredData,
    adult: metadata.adult, siteName: metadata.siteName, openGraph: metadata.openGraph, twitter: metadata.twitter } : options;
  const images = openGraph?.images || (thumbnail ? [{ url: thumbnail, alt: title }] : []);
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${escapeHtml(robots)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}">` : ''}
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="${escapeHtml(openGraph?.type || 'website')}">
<meta property="og:site_name" content="${escapeHtml(siteName)}">${openGraph?.locale ? `<meta property="og:locale" content="${escapeHtml(openGraph.locale)}">` : ''}
${images.map(image => `<meta property="og:image" content="${escapeHtml(image.url)}"><meta property="og:image:alt" content="${escapeHtml(image.alt || title)}">${image.width ? `<meta property="og:image:width" content="${image.width}">` : ''}${image.height ? `<meta property="og:image:height" content="${image.height}">` : ''}`).join('')}
<meta name="twitter:card" content="${escapeHtml(twitter?.card || (images.length ? 'summary_large_image' : 'summary'))}"><meta name="twitter:title" content="${escapeHtml(twitter?.title || title)}"><meta name="twitter:description" content="${escapeHtml(twitter?.description || description)}">
${(twitter?.images || images.map(image => image.url)).map(url => `<meta name="twitter:image" content="${escapeHtml(url)}">`).join('')}
${adult ? '<meta name="rating" content="adult">' : ''}${schema ? `<script type="application/ld+json">${safeJson(schema)}</script>` : ''}
<link rel="stylesheet" href="/assets/catalog.css"><script src="/assets/player.js" defer></script></head>
<body><header><a href="/" class="brand">${escapeHtml(siteName)}</a> <a href="/categories/${adult ? '?rating=adult' : ''}">Categories</a></header><main>${body}</main><footer>Video sources can be changed without changing the page URL.</footer></body></html>`;
}
function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map((item, i) => `<li>${i === items.length - 1 ? `<span aria-current="page">${escapeHtml(item.name)}</span>` : `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`}</li>`).join('')}</ol></nav>`;
}
function cards(videos) {
  return `<div class="cards">${videos.map(video => `<a class="card" href="${escapeHtml(video.url)}">
${video.thumbnail?.url ? `<img src="${escapeHtml(video.thumbnail.url)}" alt="${escapeHtml(video.thumbnail.alt || '')}" width="${video.thumbnail.width || 1280}" height="${video.thumbnail.height || 720}" loading="lazy">` : '<div class="placeholder">Video</div>'}
<h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.tags.join(' · '))}</p></a>`).join('')}</div>`;
}
export function renderPage(page, config = {}) {
  const seo = page.seo || buildVideoSeo(page, config);
  const video = page.video, active = page.sources.find(source => source.id === page.selectedSourceId);
  const player = active ? (active.kind === 'embed' ?
    `<iframe id="video-player" src="${escapeHtml(active.url)}" title="${escapeHtml(video.title)}" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` :
    `<video id="video-player" controls preload="metadata" ${video.thumbnail?.url ? `poster="${escapeHtml(video.thumbnail.url)}"` : ''}><source src="${escapeHtml(active.url)}"></video>`) : '<p class="notice">This video is temporarily unavailable.</p>';
  return frame(`${breadcrumbs(seo.breadcrumbs)}<h1>${escapeHtml(video.h1 || video.title)}</h1><div class="player-area" id="player-area">${player}</div>
<div class="sources" aria-label="Video sources">${page.sources.map(source => `<button type="button" data-source-id="${source.id}" ${source.id === page.selectedSourceId ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${escapeHtml(source.provider)}</button>`).join('')}</div>
<p id="playback-message" role="status">${active ? 'Playback problem? Choose another source above.' : ''}</p>
<script type="application/json" id="player-data">${safeJson({ sources: page.sources, selectedSourceId: page.selectedSourceId, title: video.title, poster: video.thumbnail?.url })}</script>
<article><p>${escapeHtml(video.description)}</p>${video.author ? `<p>By ${escapeHtml(video.author)}</p>` : ''}
${video.durationSeconds ? `<p>Duration: ${escapeHtml(isoDuration(video.durationSeconds))}</p>` : ''}
${video.media?.quality ? `<p>Quality: ${escapeHtml(video.media.quality.toUpperCase())}</p>` : ''}
${Number.isSafeInteger(video.metrics?.views) ? `<p>Views: ${video.metrics.views}</p>` : ''}
${video.metrics?.ratingCount > 0 && Number.isFinite(video.metrics.ratingAverage) ? `<p>Rating: ${video.metrics.ratingAverage}/5 (${video.metrics.ratingCount} ratings)</p>` : ''}
${video.bodyText ? `<div class="body-copy">${escapeHtml(video.bodyText)}</div>` : ''}
${video.transcript ? `<details><summary>Transcript</summary><p class="body-copy">${escapeHtml(video.transcript)}</p></details>` : ''}</article>
<div class="tags">${video.tags.map(tag => `<a href="/?tag=${encodeURIComponent(tag)}&rating=${video.contentRating}">${escapeHtml(tag)}</a>`).join('')}</div>
<nav class="tags" aria-label="Categories">${(page.categories || []).map(category => `<a href="${escapeHtml(category.url)}">${escapeHtml(category.name)}</a>`).join('')}</nav>
<section><h2>Recommended videos</h2>${page.recommendations.length ? cards(page.recommendations) : '<p>More matching videos will appear as the catalog grows.</p>'}</section>`, { seo });
}
export function renderCategories(result, config, { cursor, limit = 24, rating = 'general' } = {}) {
  const seo = result.seo || buildDirectorySeo(result, config, { cursor, limit, rating }), content = config.sitePages.categories;
  const next = result.nextCursor ? `/categories/?${new URLSearchParams({ cursor: result.nextCursor, limit, rating })}` : null;
  return frame(`${breadcrumbs(seo.breadcrumbs)}<h1>${escapeHtml(content.h1)}</h1><p>${escapeHtml(content.description)}</p><div class="cards">${result.categories.map(category =>
    `<a class="card" href="${escapeHtml(category.url)}">${category.thumbnail?.url ? `<img src="${escapeHtml(category.thumbnail.url)}" alt="${escapeHtml(category.thumbnail.alt)}" loading="lazy">` : ''}<h2>${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description.slice(0, 300))}</p></a>`).join('')}</div>
    ${!result.categories.length ? '<p>No categories available yet.</p>' : ''}${next ? `<a rel="next" href="${escapeHtml(next)}">Next categories</a>` : ''}
    ${content.bodyText ? `<article class="body-copy">${escapeHtml(content.bodyText)}</article>` : ''}`, { seo });
}
export function renderCategory(result, { cursor, limit = 24 } = {}, config = {}) {
  const category = result.category;
  const seo = result.seo || buildCategorySeo(result, config, { cursor, limit });
  const next = result.nextCursor ? `/category/${category.slug}/?${new URLSearchParams({ cursor: result.nextCursor, limit })}` : null;
  return frame(`${breadcrumbs(seo.breadcrumbs)}<h1>${escapeHtml(category.h1 || category.name)}</h1><p>${escapeHtml(category.description)}</p>
    ${result.videos.length ? cards(result.videos) : '<p>No published videos in this category yet.</p>'}
    ${next ? `<a rel="next" href="${escapeHtml(next)}">Next videos</a>` : ''}
    ${category.bodyText ? `<article class="body-copy">${escapeHtml(category.bodyText)}</article>` : ''}`, { seo });
}
export function renderListing(result, config, { tag, rating = 'general' } = {}) {
  const next = result.nextCursor ? `/?${new URLSearchParams({ cursor: result.nextCursor, ...(tag ? { tag } : {}), rating })}` : null;
  return frame(`<h1>${tag ? `Videos tagged ${escapeHtml(tag)}` : 'Video catalog'}</h1>
${result.videos.length ? cards(result.videos) : '<p>No published videos yet. Add video metadata and a ready source, then publish it through the admin API.</p>'}
${next ? `<a class="next" href="${escapeHtml(next)}">Next videos</a>` : ''}`, {
    title: tag ? `${tag} videos` : 'HeyxDude', description: 'Browse video watch pages on HeyxDude.', canonical: `${config.siteOrigin}/`,
    robots: tag || next || rating !== 'general' ? 'noindex,follow' : 'index,follow', adult: rating === 'adult',
  });
}
