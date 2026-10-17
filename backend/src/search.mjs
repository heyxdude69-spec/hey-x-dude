import { createHash } from 'node:crypto';
import { usableSource } from './catalog.mjs';

export const SEARCH_INDEX_KEYS = { status: 1, contentRating: 1, title: 'text', tags: 'text', categories: 'text', language: 'text' };
export const SEARCH_INDEX_OPTIONS = { name: 'catalog_search', default_language: 'none', language_override: 'searchIndexLanguage',
  weights: { title: 10, tags: 4, categories: 3, language: 1 } };
export function normalizeSearch(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function makeSearch(database, cache, config) {
  return async function search(raw, rating, page = null) {
    const text = normalizeSearch(raw);
    if (text && text.length < 2) return { query: text, videos: [], ...(page === null ? {} : { page, hasMore: false }) };
    const digest = createHash('sha256').update(text).digest('hex');
    return cache.getOrLoad(`search:v2:${rating}:${page ?? "suggest"}:${digest}`, async () => {
      const filter = { status: 'published', contentRating: rating,
        ...(text ? { $text: { $search: text, $language: 'none' } } : {}) };
      const fields = { slug: 1, title: 1, thumbnail: 1, categories: 1, language: 1, durationSeconds: 1,
        ...(text ? { score: { $meta: 'textScore' } } : {}) };
      const query = database.Video.find(filter).select(fields)
        .sort(text ? { score: { $meta: 'textScore' }, publishedAt: -1, _id: -1 } : { publishedAt: -1, _id: -1 })
        .limit(page === null ? 28 : 49).maxTimeMS(config.queryTimeoutMs);
      if (page !== null) query.skip((page - 1) * 48);
      const found = await query.lean();
      const hasMore = page !== null && page < 100 && found.length > 48;
      const rows = page === null ? found : found.slice(0, 48);
      if (!rows.length) return { query: text, videos: [], ...(page === null ? {} : { page, hasMore: false }) };
      const sources = await database.VideoSource.find({ videoId: { $in: rows.map(row => row._id) }, enabled: true, status: 'ready', availability: { $ne: 'unavailable' } })
        .select('videoId provider kind embedUrl contentUrl enabled status availability').limit(page === null ? 560 : 960).maxTimeMS(config.queryTimeoutMs).lean();
      const playable = new Set(sources.filter(source => usableSource(source, config)).map(source => String(source.videoId)));
      const selected = rows.filter(row => playable.has(String(row._id))).slice(0, page === null ? 7 : 48);
      const slugs = [...new Set(selected.flatMap(row => row.categories || []))];
      const categories = slugs.length ? await database.Category.find({ slug: { $in: slugs }, status: 'active', contentRating: rating })
        .select('slug name').limit(page === null ? 84 : 576).maxTimeMS(config.queryTimeoutMs).lean() : [];
      const names = new Map(categories.map(row => [row.slug, row.name]));
      return { query: text, ...(page === null ? {} : { page, hasMore }), videos: selected.map(row => ({ id: String(row._id), slug: row.slug, title: row.title,
        thumbnail: row.thumbnail, durationSeconds: row.durationSeconds ?? null, category: (row.categories || []).map(slug => names.get(slug)).find(Boolean) || '', language: row.language || '' })) };
    }, 30);
  };
}
