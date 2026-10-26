export type SearchSuggestion = { id: string; slug: string; title: string; thumbnail: string; thumbnailFallbacks?: string[]; category: string; language: string; durationSeconds?: number | null };
export function parseSuggestions(value: unknown, maximum = 7): SearchSuggestion[] {
  if (!value || typeof value !== 'object' || !('videos' in value) || !Array.isArray(value.videos) || value.videos.length > maximum) throw new Error('Invalid search response');
  return value.videos.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid suggestion');
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.slug !== 'string' || row.slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || typeof row.title !== 'string' || !row.title.trim()) throw new Error('Invalid suggestion');
    let thumbnail = '/thumbnails/scene-1.svg';
    const image = row.thumbnail as { url?: unknown; fallbackUrls?: unknown } | undefined;
    if (typeof image?.url === 'string') {
      try { const url = new URL(image.url); if (url.protocol === 'https:' && !url.username && !url.password) thumbnail = url.href; } catch {}
    }
    const thumbnailFallbacks = Array.isArray(image?.fallbackUrls) ? [...new Set(image.fallbackUrls.slice(0, 5).flatMap(value => {
      if (typeof value !== 'string') return [];
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.href !== thumbnail ? [url.href] : []; }
      catch { return []; }
    }))] : [];
    return { id: row.id, slug: row.slug, title: row.title, thumbnail, ...(thumbnailFallbacks.length ? { thumbnailFallbacks } : {}),
      category: typeof row.category === 'string' ? row.category : '', language: typeof row.language === 'string' ? row.language : '', durationSeconds: typeof row.durationSeconds === 'number' && Number.isInteger(row.durationSeconds) && row.durationSeconds >= 0 && row.durationSeconds <= 86400 ? row.durationSeconds : null };
  });
}
