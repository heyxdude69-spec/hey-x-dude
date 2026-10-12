import { parseCategoryPage, type CatalogCard } from './category-videos-api.ts';
export type VideoSource = { id: string; provider: string; kind: 'embed' | 'direct'; embedUrl: string };
export type VideoPageData = {
  slug: string; title: string; h1: string; description: string; bodyText: string; language: string; uploadDate?: string;
  tags: string[]; card: CatalogCard; categories: { slug: string; name: string }[]; servers: VideoSource[];
  recommendations: CatalogCard[]; exploreUrl: string;
  seo: { title: string; description: string; index: boolean; canonical: string; image?: string; adult: boolean };
  structuredData: Record<string, unknown>[];
};
export class VideoNotFound extends Error {}
const reserved = new Set(['categories', 'api', 'tag', 'video', 'assets', 'health', 'sitemaps']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid video response');
  return v as Record<string, any>;
};
function https(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
export function siteOrigin(): string {
  const url = new URL(process.env.SITE_URL || 'http://localhost:3001');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid SITE_URL');
  return url.origin;
}
export function parseVideoPage(value: unknown, origin: string): VideoPageData {
  const data = object(value), video = object(data.video);
  if (typeof video.slug !== 'string' || !slugPattern.test(video.slug) || reserved.has(video.slug) ||
      typeof video.title !== 'string' || typeof video.description !== 'string' || !Array.isArray(data.sources) ||
      !Array.isArray(data.categories) || data.categories.length > 12 || data.sources.length > 20 ||
      !Array.isArray(data.recommendations) || data.recommendations.length > 16 || typeof video._id !== 'string') throw new Error('Invalid video page');
  const categories = data.categories.map((v: unknown): {slug: string; name: string} => {
    const row = object(v);
    if (typeof row.slug !== 'string' || !slugPattern.test(row.slug) || typeof row.name !== 'string') throw new Error('Invalid category');
    return { slug: row.slug, name: row.name };
  });
  const categoryOrder: string[] = Array.isArray(video.categories) ? video.categories : [];
  categories.sort((a, b) => categoryOrder.indexOf(a.slug) - categoryOrder.indexOf(b.slug));
  const primary = categories[0], canonical = `${origin}/${video.slug}`;
  const mapCard = (row: unknown) => parseCategoryPage({ category: { slug: primary?.slug || 'videos', name: primary?.name || 'Videos' },
    videos: [row], pagination: { currentPage: 1, pageCount: 1, totalVideos: 1 } }).films[0];
  const card = mapCard({ ...video, id: String(video._id), quality: video.media?.quality });
  const servers = data.sources.map((v: unknown): VideoSource => {
    const row = object(v), url = https(row.url);
    if (typeof row.id !== 'string' || typeof row.provider !== 'string' || !['embed', 'direct'].includes(row.kind) || !url) throw new Error('Invalid source');
    return { id: row.id, provider: row.provider, kind: row.kind, embedUrl: url };
  });
  const selected = servers.findIndex(row => row.id === data.selectedSourceId);
  if (selected > 0) servers.unshift(...servers.splice(selected, 1));
  const recommendations = data.recommendations.map(mapCard).filter(row => row.slug !== video.slug);
  const uploadDate = typeof video.uploadDate === 'string' && Number.isFinite(Date.parse(video.uploadDate)) ? new Date(video.uploadDate).toISOString() : undefined;
  const image = https(video.thumbnail?.url);
  const index = video.seo?.indexAllowed === true && servers.length > 0 && !!uploadDate && !!image;
  const structuredData: Record<string, unknown>[] = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    ...(primary ? [{ '@type': 'ListItem', position: 2, name: primary.name, item: `${origin}/categories/${primary.slug}` }] : []),
    { '@type': 'ListItem', position: primary ? 3 : 2, name: video.title, item: canonical },
  ] }];
  if (servers.length && uploadDate && image) structuredData.push({ '@context': 'https://schema.org', '@type': 'VideoObject',
    '@id': `${canonical}#video`, url: canonical, name: video.title, description: video.description,
    thumbnailUrl: [image], uploadDate, inLanguage: video.language || 'en', isFamilyFriendly: video.contentRating === 'general',
    ...(card.duration && card.duration > 0 ? { duration: `PT${card.duration}S` } : {}),
    ...(servers[0].kind === 'embed' ? { embedUrl: servers[0].embedUrl } : { contentUrl: servers[0].embedUrl }) });
  return { slug: video.slug, title: video.title, h1: typeof video.h1 === 'string' && video.h1 ? video.h1 : video.title, description: video.description,
    bodyText: typeof video.bodyText === 'string' ? video.bodyText : '', language: typeof video.language === 'string' ? video.language : 'en', uploadDate,
    tags: Array.isArray(video.tags) ? video.tags.filter((tag: unknown) => typeof tag === 'string') : [],
    card, categories, servers, recommendations, exploreUrl: primary ? `/categories/${primary.slug}` : '/categories',
    seo: { title: video.seo?.title || video.title, description: video.seo?.metaDescription || video.description,
      canonical, index, image, adult: video.contentRating === 'adult' }, structuredData };
}
export function safeStructuredJson(value: unknown): string { return JSON.stringify(value).replace(/</g, '\\u003c'); }
export async function getVideoPage(slug: string): Promise<VideoPageData> {
  if (!slugPattern.test(slug) || slug.length > 180 || reserved.has(slug)) throw new VideoNotFound();
  if (!process.env.CATALOG_API_ORIGIN) throw new Error('Set CATALOG_API_ORIGIN');
  const api = new URL(process.env.CATALOG_API_ORIGIN);
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.pathname !== '/' || api.search || api.hash) throw new Error('Invalid API origin');
  const response = await fetch(new URL(`/api/videos/${slug}`, api), { cache: 'force-cache', next: { revalidate: 30 }, signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (response.status === 404) throw new VideoNotFound();
  if (!response.ok && response.status !== 503) throw new Error(`Video API unavailable (${response.status})`);
  const raw = await response.json();
  if (!raw?.video) throw new Error('Video service unavailable');
  const result = parseVideoPage(raw, siteOrigin());
  if (result.slug !== slug) throw new Error('Video slug mismatch');
  return result;
}
