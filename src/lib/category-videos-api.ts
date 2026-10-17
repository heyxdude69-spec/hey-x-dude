export type CatalogCard = {
  id: string; slug: string; title: string; thumbnail: string; thumbnailAlt: string;
  duration: number | null; views: string; rating: number | null; quality: string;
  genre: string; movie: string;
};
export type CategoryVideos = {
  category: { slug: string; name: string; seo: { title?: string; metaDescription?: string; indexAllowed?: boolean }; description: string };
  films: CatalogCard[];
  pagination: { currentPage: number; pageCount: number; totalVideos: number };
};
export class CategoryNotFound extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid category data');
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid metric');
  return value;
}
export function parseCategoryPage(value: unknown): CategoryVideos {
  const data = record(value), category = record(data.category), pagination = record(data.pagination);
  if (typeof category.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) ||
      typeof category.name !== 'string' || !category.name.trim() || !Array.isArray(data.videos) || data.videos.length > 25) {
    throw new Error('Invalid category response');
  }
  const currentPage = count(pagination.currentPage), pageCount = count(pagination.pageCount);
  if (currentPage < 1 || pageCount < currentPage || pageCount > 1000) throw new Error('Invalid pagination');
  const seo = category.seo ? record(category.seo) : {};
  const name = category.name;
  const films = data.videos.map((item: unknown): CatalogCard => {
    const row = record(item), metrics = record(row.metrics || {}), image = record(row.thumbnail || {});
    if (typeof row.id !== 'string' || typeof row.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
        typeof row.title !== 'string' || !row.title.trim()) throw new Error('Invalid video card');
    const likes = count(metrics.likes ?? 0), dislikes = count(metrics.dislikes ?? 0), votes = likes + dislikes;
    let thumbnail = '/thumbnails/scene-1.svg';
    if (typeof image.url === 'string') {
      try {
        const url = new URL(image.url);
        if (url.protocol === 'https:' && !url.username && !url.password) thumbnail = url.href;
      } catch { /* Use local placeholder. */ }
    }
    const qualities: Record<string, string> = { sd: 'SD', hd: 'HD', fullhd: 'Full HD', uhd: '4K' };
    return { id: row.id, slug: row.slug, title: row.title, thumbnail,
      thumbnailAlt: typeof image.alt === 'string' && image.alt ? image.alt : row.title,
      duration: row.durationSeconds == null ? null : count(row.durationSeconds),
      views: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count(metrics.views ?? 0)),
      rating: votes ? Math.round(likes / votes * 100) : null,
      quality: typeof row.quality === 'string' ? qualities[row.quality] || '—' : '—', genre: name, movie: name };
  });
  return { category: { slug: category.slug, name, description: typeof category.description === 'string' ? category.description : '',
    seo: { title: typeof seo.title === 'string' ? seo.title : undefined,
      metaDescription: typeof seo.metaDescription === 'string' ? seo.metaDescription : undefined,
      indexAllowed: seo.indexAllowed === true } }, films,
    pagination: { currentPage, pageCount, totalVideos: count(pagination.totalVideos) } };
}

export function normalizeCategoryPage(value?: string): number {
  const page = Number(value || 1);
  return Number.isSafeInteger(page) && page >= 1 && page <= 1000 ? page : 1;
}

export async function getCategoryVideos(slug: string, page: number): Promise<CategoryVideos> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new CategoryNotFound();
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) throw new Error('Set CATALOG_API_ORIGIN in .env.local');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
  const url = new URL(`/api/categories/${slug}/videos`, origin);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', '25');
  const response = await fetch(url, { cache: 'force-cache', next: { revalidate: 60 }, signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (response.status === 404) throw new CategoryNotFound();
  if (!response.ok) throw new Error(`Category videos API unavailable (${response.status})`);
  const data = parseCategoryPage(await response.json());
  if (data.category.slug !== slug) throw new Error('Category slug mismatch');
  return data;
}
