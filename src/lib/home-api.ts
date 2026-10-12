import { parseCategoryPage, type CatalogCard } from './category-videos-api.ts';
export type HomeSection = { key: string; title: string; badgeText: string; seeMoreLabel: string; seeMoreUrl: string;
  paginate: boolean; films: CatalogCard[]; pagination: { currentPage: number; pageCount: number } };
export type HomeData = { seo: { title: string; metaDescription: string; indexAllowed: boolean }; contentRating: 'general' | 'adult';
  selectedSection: string | null; emptyMessage: string; sections: HomeSection[] };
export class HomeCollectionNotFound extends Error {}
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid home response');
  return value as Record<string, any>;
};
export function parseHome(value: unknown): HomeData {
  const raw = object(value), seo = object(raw.seo);
  if (typeof seo.title !== 'string' || typeof seo.metaDescription !== 'string' || typeof seo.indexAllowed !== 'boolean' ||
      !['general', 'adult'].includes(raw.contentRating) || typeof raw.emptyMessage !== 'string' ||
      !Array.isArray(raw.sections) || raw.sections.length > 12 || !(raw.selectedSection === null || typeof raw.selectedSection === 'string')) throw new Error('Invalid homepage settings');
  const sections = raw.sections.map((value: unknown): HomeSection => {
    const row = object(value), pages = object(row.pagination);
    if (typeof row.key !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.key) ||
        typeof row.title !== 'string' || typeof row.badgeText !== 'string' || typeof row.seeMoreLabel !== 'string' ||
        typeof row.seeMoreUrl !== 'string' || !/^\/(?:categories\/[a-z0-9-]+|\?section=[a-z0-9-]+)$/.test(row.seeMoreUrl) ||
        typeof row.paginate !== 'boolean' || !Array.isArray(row.videos) || row.videos.length > 48 ||
        !Number.isInteger(pages.currentPage) || !Number.isInteger(pages.pageCount) || pages.currentPage < 1 || pages.pageCount < pages.currentPage || pages.pageCount > 500) throw new Error('Invalid home section');
    const films = row.videos.map((value: unknown) => {
      const card = object(value);
      if (typeof card.categoryName !== 'string') throw new Error('Missing category label');
      return parseCategoryPage({ category: { slug: 'videos', name: card.categoryName }, videos: [card],
        pagination: { currentPage: 1, pageCount: 1, totalVideos: 1 } }).films[0];
    });
    return { key: row.key, title: row.title, badgeText: row.badgeText, seeMoreLabel: row.seeMoreLabel, seeMoreUrl: row.seeMoreUrl,
      paginate: row.paginate, films, pagination: { currentPage: pages.currentPage, pageCount: pages.pageCount } };
  });
  if (new Set(sections.map(row => row.key)).size !== sections.length) throw new Error('Duplicate home sections');
  return { seo: { title: seo.title, metaDescription: seo.metaDescription, indexAllowed: seo.indexAllowed },
    selectedSection: raw.selectedSection, contentRating: raw.contentRating, emptyMessage: raw.emptyMessage, sections };
}
export async function getHome(section?: string, page = 1): Promise<HomeData> {
  if (section && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section)) throw new HomeCollectionNotFound();
  if (!process.env.CATALOG_API_ORIGIN) throw new Error('Set CATALOG_API_ORIGIN');
  const base = new URL(process.env.CATALOG_API_ORIGIN);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Invalid API origin');
  const url = new URL('/api/home', base); url.searchParams.set('page', String(page));
  if (section) url.searchParams.set('section', section);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (response.status === 404) throw new HomeCollectionNotFound();
  if (!response.ok) throw new Error(`Home API unavailable (${response.status})`);
  return parseHome(await response.json());
}
