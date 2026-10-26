export type CategoryCard = {
  slug: string;
  name: string;
  thumbnail: { url?: string; alt?: string; fallbackUrls?: string[] };
  videoCount: number;
};

export function mapCategory(value: unknown): CategoryCard {
  if (!value || typeof value !== 'object') throw new Error('Invalid category response');
  const row = value as Record<string, unknown>;
  if (typeof row.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
      typeof row.name !== 'string' || !row.name.trim() ||
      typeof row.videoCount !== 'number' || !Number.isSafeInteger(row.videoCount) || row.videoCount < 0) {
    throw new Error('Invalid category fields');
  }
  const image = row.thumbnail && typeof row.thumbnail === 'object'
    ? row.thumbnail as Record<string, unknown> : {};
  let url: string | undefined;
  if (typeof image.url === 'string') {
    try {
      const parsed = new URL(image.url);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href;
    } catch { /* Missing or invalid posters use the local fallback. */ }
  }
  const fallbackUrls = Array.isArray(image.fallbackUrls) ? [...new Set(image.fallbackUrls.slice(0, 5).flatMap(value => {
    if (typeof value !== 'string') return [];
    try { const parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? [parsed.href] : []; }
    catch { return []; }
  }).filter(value => value !== url)] : [];
  return { slug: row.slug, name: row.name, videoCount: row.videoCount,
    thumbnail: { url, alt: typeof image.alt === 'string' ? image.alt : row.name, ...(fallbackUrls.length ? { fallbackUrls } : {}) } };
}

// Called only from the server-rendered categories page. No credentials in the browser.
export async function getCategoryCards(): Promise<CategoryCard[]> {
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) throw new Error('Set CATALOG_API_ORIGIN in .env.local');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid CATALOG_API_ORIGIN');
  const rating = process.env.CATALOG_CONTENT_RATING || 'general';
  if (rating !== 'general' && rating !== 'adult') throw new Error('Invalid CATALOG_CONTENT_RATING');
  const results = new Map<string, CategoryCard>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const endpoint = new URL('/api/categories', origin);
    endpoint.searchParams.set('limit', '48');
    endpoint.searchParams.set('rating', rating);
    if (cursor) endpoint.searchParams.set('cursor', cursor);
    const response = await fetch(endpoint, { cache: 'force-cache', next: { revalidate: 120 }, signal: AbortSignal.timeout(8000),
      headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
    if (!response.ok) throw new Error(`Category API unavailable (${response.status})`);
    const data = await response.json();
    if (!data || !Array.isArray(data.categories) || data.categories.length > 48) throw new Error('Invalid category page');
    for (const item of data.categories) {
      const card = mapCategory(item);
      results.set(card.slug, card);
    }
    const nextCursor: unknown = data.nextCursor;
    if (nextCursor === null) return [...results.values()];
    if (typeof nextCursor !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextCursor) ||
        seenCursors.has(nextCursor)) throw new Error('Invalid category cursor');
    cursor = nextCursor;
    seenCursors.add(nextCursor);
  }
  throw new Error('Category directory exceeds pagination limit');
}


export type CategoryBatch = { categories: CategoryCard[]; nextCursor: string | null };
export async function getCategoryBatch(cursor?: string): Promise<CategoryBatch> {
  if (cursor !== undefined && (cursor.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cursor))) throw new Error('Invalid category cursor');
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) throw new Error('Category service unavailable');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
  const rating = process.env.CATALOG_CONTENT_RATING || 'general';
  if (!['general', 'adult'].includes(rating)) throw new Error('Invalid rating');
  const url = new URL('/api/categories', origin);
  url.searchParams.set('limit', '48'); url.searchParams.set('rating', rating);
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, { cache: 'force-cache', next: { revalidate: 120 }, signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (!response.ok) throw new Error('Category service unavailable');
  return parseCategoryBatch(await response.json(), cursor);
}
export function parseCategoryBatch(value: unknown, cursor?: string): CategoryBatch {
  if (!value || typeof value !== 'object') throw new Error('Invalid categories response');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.categories) || raw.categories.length > 48) throw new Error('Invalid category batch');
  const categories = raw.categories.map(mapCategory);
  if (new Set(categories.map(row => row.slug)).size !== categories.length) throw new Error('Duplicate categories');
  const next = raw.nextCursor;
  if (next !== null && (typeof next !== 'string' || next.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next) || next === cursor || next !== categories.at(-1)?.slug)) throw new Error('Invalid category cursor');
  return { categories, nextCursor: next as string | null };
}
