import { parseCategoryPage, type CatalogCard } from './category-videos-api.ts';
export class TagNotFound extends Error {}
export type TagPageData = { slug: string; name: string; adult: boolean; films: CatalogCard[];
  pagination: { currentPage: number; pageCount: number; totalVideos: number } };
export function validTagSlug(slug: string): boolean {
  return slug.length <= 80 && /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) && slug === slug.normalize('NFKC').toLowerCase();
}
export function parseTagPage(value: unknown, slug: string, rating: string): TagPageData {
  if (!value || typeof value !== 'object') throw new Error('Invalid tag response');
  const data = value as Record<string, any>, tag = data.tag;
  if (!tag || tag.slug !== slug || !validTagSlug(tag.slug) || typeof tag.name !== 'string' || !tag.name.trim() || tag.contentRating !== rating) throw new Error('Invalid tag response');
  const parsed = parseCategoryPage({ ...data, category: { slug: 'tag', name: tag.name } });
  return { slug, name: tag.name, adult: rating === 'adult', films: parsed.films, pagination: parsed.pagination };
}
export async function getTagVideos(slug: string, page: number): Promise<TagPageData> {
  if (!validTagSlug(slug)) throw new TagNotFound();
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) throw new Error('Set CATALOG_API_ORIGIN');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
  const rating = process.env.CATALOG_CONTENT_RATING || 'general';
  if (!['general', 'adult'].includes(rating)) throw new Error('Invalid content rating');
  const url = new URL(`/api/tags/${encodeURIComponent(slug)}/videos`, origin);
  url.searchParams.set('page', String(page)); url.searchParams.set('rating', rating);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (response.status === 404) throw new TagNotFound();
  if (!response.ok) throw new Error(`Tag API unavailable (${response.status})`);
  const data = parseTagPage(await response.json(), slug, rating);
  if (data.pagination.currentPage !== page) throw new Error('Tag page mismatch');
  return data;
}
