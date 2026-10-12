export type NavigationCategory = { slug: string; name: string };
export function parseNavigation(value: unknown): NavigationCategory[] {
  if (!value || typeof value !== 'object' || !('categories' in value) || !Array.isArray(value.categories) || value.categories.length > 500) throw new Error('Invalid navigation response');
  const seen = new Set<string>();
  return value.categories.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('slug' in row) || !('name' in row) ||
      typeof row.slug !== 'string' || row.slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
      typeof row.name !== 'string' || !row.name.trim() || row.name.length > 150 || seen.has(row.slug)) throw new Error('Invalid navigation category');
    seen.add(row.slug);
    return { slug: row.slug, name: row.name };
  });
}
export async function getNavigationCategories(): Promise<NavigationCategory[]> {
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) throw new Error('Set CATALOG_API_ORIGIN');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
  const rating = process.env.CATALOG_CONTENT_RATING || 'general';
  if (!['general', 'adult'].includes(rating)) throw new Error('Invalid content rating');
  const endpoint = new URL('/api/navigation', origin);
  endpoint.searchParams.set('rating', rating);
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
  if (!response.ok) throw new Error(`Navigation API unavailable (${response.status})`);
  return parseNavigation(await response.json());
}
