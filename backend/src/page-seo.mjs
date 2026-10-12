const INDEX_ROBOTS = 'index,follow,max-snippet:-1,max-video-preview:-1,max-image-preview:large';
const siteFor = (config, canonical) => ({ origin: config.siteOrigin || new URL(canonical).origin,
  ...(config.sitePages?.site || { name: 'Video Catalog', language: 'en' }) });
const absolute = (url, origin) => new URL(url, origin).href;
const validDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : undefined;
export function isoDuration(seconds) {
  if (!Number.isInteger(seconds) || seconds < 1) return undefined;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${rest ? `${rest}S` : ''}`;
}
export function videoStructuredData(page) {
  const video = page.video, source = page.sources.find(s => s.id === page.selectedSourceId);
  if (!source || !validDate(video.uploadDate) || !video.thumbnail?.url) return null;
  return {
    '@context': 'https://schema.org', '@type': 'VideoObject', '@id': `${video.canonicalUrl}#video`, name: video.title,
    description: video.description, thumbnailUrl: [video.thumbnail.url], uploadDate: validDate(video.uploadDate),
    ...(isoDuration(video.durationSeconds) ? { duration: isoDuration(video.durationSeconds) } : {}),
    ...(source.kind === 'embed' ? { embedUrl: source.url } : { contentUrl: source.url }),
    url: video.canonicalUrl, isFamilyFriendly: video.contentRating === 'general', inLanguage: video.language || 'en',
    ...(video.media?.width ? { width: video.media.width, height: video.media.height } : {}),
    ...(video.tags?.length ? { keywords: video.tags.join(', ') } : {}),
    ...(video.metrics?.origin === 'site' && Number.isSafeInteger(video.metrics.views) && video.metrics.views >= 0 ? {
      interactionStatistic: { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: video.metrics.views },
    } : {}),
  };
}
function bundle({ config, canonical, title, description, language, thumbnail, indexable, breadcrumbs, node, extras = [], ogType = 'website', adult = false }) {
  const site = siteFor(config, canonical), pageId = `${canonical}#webpage`, breadcrumbId = `${canonical}#breadcrumb`;
  const images = thumbnail?.url ? [{ url: thumbnail.url, alt: thumbnail.alt || title,
    ...(thumbnail.width ? { width: thumbnail.width } : {}), ...(thumbnail.height ? { height: thumbnail.height } : {}) }] : [];
  const graph = [{ '@type': 'WebSite', '@id': `${site.origin}/#website`, url: `${site.origin}/`, name: site.name, inLanguage: site.language,
    ...(site.publisher ? { publisher: { '@id': `${site.origin}/#publisher` } } : {}),
  }];
  if (site.publisher) graph.push({ '@type': 'Organization', '@id': `${site.origin}/#publisher`, name: site.publisher.name, url: site.publisher.url,
    ...(site.logo ? { logo: { '@type': 'ImageObject', url: site.logo.url, contentUrl: site.logo.url, caption: site.logo.alt || site.publisher.name,
      ...(site.logo.width ? { width: site.logo.width } : {}), ...(site.logo.height ? { height: site.logo.height } : {}) } } : {}),
  });
  const imageId = `${canonical}#primaryimage`;
  if (images.length) graph.push({ '@type': 'ImageObject', '@id': imageId, url: thumbnail.url, contentUrl: thumbnail.url,
    caption: thumbnail.alt || title, ...(thumbnail.width ? { width: thumbnail.width } : {}), ...(thumbnail.height ? { height: thumbnail.height } : {}),
  });
  graph.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: breadcrumbs.map((item, i) => ({
    '@type': 'ListItem', position: i + 1, name: item.name, item: item.url,
  })) });
  graph.push({ '@id': pageId, url: canonical, name: title, description, inLanguage: language,
    isPartOf: { '@id': `${site.origin}/#website` }, breadcrumb: { '@id': breadcrumbId }, isFamilyFriendly: !adult,
    ...(images.length ? { primaryImageOfPage: { '@id': imageId } } : {}), ...node });
  graph.push(...extras);
  return { title, description, canonicalUrl: canonical, language, indexable, robots: indexable ? INDEX_ROBOTS : 'noindex,follow',
    adult, siteName: site.name, openGraph: { title, description, url: canonical, type: ogType, siteName: site.name,
      locale: language.includes('-') ? language.replaceAll('-', '_') : ({ en: 'en_US', hi: 'hi_IN' }[language] || language), images },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description, images: images.map(image => image.url) },
    breadcrumbs, structuredData: { '@context': 'https://schema.org', '@graph': graph },
  };
}
function listSchema(canonical, rows, origin, order) {
  return { '@type': 'ItemList', '@id': `${canonical}#list`, itemListOrder: `https://schema.org/${order}`,
    numberOfItems: rows.length, itemListElement: rows.map((row, i) => ({ '@type': 'ListItem', position: i + 1,
      url: absolute(row.url, origin), name: row.title || row.name,
    })) };
}
export function buildDirectorySeo(result, config, { cursor, limit = 24, rating = 'general' } = {}) {
  const page = config.sitePages.categories, site = config.sitePages.site;
  const params = new URLSearchParams({ ...(cursor ? { cursor, limit } : {}), ...(rating !== 'general' ? { rating } : {}) });
  const canonical = `${config.siteOrigin}/categories/${params.size ? `?${params}` : ''}`;
  const list = listSchema(canonical, result.categories, config.siteOrigin, 'ItemListOrderAscending');
  return bundle({ config, canonical, title: page.seo.title, description: page.seo.metaDescription, language: site.language, thumbnail: page.thumbnail,
    indexable: !cursor && rating === 'general' && page.seo.indexAllowed && result.categories.length > 0, adult: rating === 'adult',
    breadcrumbs: [{ name: 'Home', url: `${config.siteOrigin}/` }, { name: page.h1, url: canonical }],
    node: { '@type': 'CollectionPage', mainEntity: { '@id': list['@id'] } }, extras: [list],
  });
}
export function buildCategorySeo(result, config, { cursor, limit = 24, page } = {}) {
  const currentPage = result.pagination?.currentPage || page || 1;
  const category = result.category, canonical = category.canonicalUrl + (cursor ? `?${new URLSearchParams({ cursor, limit })}` : currentPage > 1 ? `?${new URLSearchParams({ page: currentPage, limit })}` : '');
  const site = siteFor(config, canonical), list = listSchema(canonical, result.videos, site.origin, 'ItemListOrderDescending');
  return bundle({ config, canonical, title: category.seo.title || category.name, description: category.seo.metaDescription || category.description,
    language: category.language || site.language, thumbnail: category.thumbnail,
    indexable: !cursor && category.seo.indexAllowed && result.videos.length > 0, adult: category.contentRating === 'adult',
    breadcrumbs: [{ name: 'Home', url: `${site.origin}/` }, { name: 'Categories', url: `${site.origin}/categories/${category.contentRating === 'adult' ? '?rating=adult' : ''}` },
      { name: category.name, url: canonical }],
    node: { '@type': 'CollectionPage', mainEntity: { '@id': list['@id'] },
      ...(validDate(category.updatedAt) ? { dateModified: validDate(category.updatedAt) } : {}) }, extras: [list],
  });
}
export function buildVideoSeo(page, config = {}) {
  if (config.publicSiteOrigin) config = { ...config, siteOrigin: config.publicSiteOrigin };
  const video = page.video, canonical = video.canonicalUrl, site = siteFor(config, canonical), schema = videoStructuredData(page);
  const breadcrumbs = [{ name: 'Home', url: `${site.origin}/` },
    { name: 'Categories', url: `${site.origin}/categories/${video.contentRating === 'adult' ? '?rating=adult' : ''}` },
    ...(page.categories?.length ? [{ name: page.categories[0].name, url: absolute(page.categories[0].url, site.origin) }] : []),
    { name: video.title, url: canonical }];
  const extra = schema ? { ...schema } : null;
  if (extra) delete extra['@context'];
  return bundle({ config, canonical, title: video.seo.title || video.title, description: video.seo.metaDescription || video.description,
    language: video.language || site.language, thumbnail: video.thumbnail, indexable: !!schema && !!video.seo.indexAllowed,
    adult: video.contentRating === 'adult', ogType: 'video.other', breadcrumbs,
    node: { '@type': 'WebPage', ...(schema ? { mainEntity: { '@id': schema['@id'] } } : {}),
      ...(validDate(video.publishedAt) ? { datePublished: validDate(video.publishedAt) } : {}),
      ...(validDate(video.updatedAt) ? { dateModified: validDate(video.updatedAt) } : {}) }, extras: extra ? [extra] : [],
  });
}
