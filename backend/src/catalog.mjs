import mongoose from 'mongoose';
import { approvedUrl } from './config.mjs';

const CARD_FIELDS = 'slug title h1 description thumbnail tags durationSeconds media.quality metrics language contentRating publishedAt updatedAt seo.indexAllowed status';
const SOURCE_FIELDS = 'videoId provider externalVideoId kind embedUrl contentUrl priority enabled status availability providerMetadata.posterUrl';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function usableSource(source, config) {
  return source.enabled && source.status === 'ready' && source.availability !== 'unavailable' &&
    approvedUrl(source.kind === 'embed' ? source.embedUrl : source.contentUrl, source.provider, config);
}
function safePosterUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export function orderSources(sources, config) {
  return sources.filter(source => usableSource(source, config)).sort((a, b) =>
    a.priority - b.priority || String(a._id).localeCompare(String(b._id)));
}
export function rankRecommendations(candidates, video, limit = 12) {
  const tags = new Set(video.tags), seen = new Set();
  return candidates.filter(candidate => {
    const id = String(candidate._id);
    if (id === String(video._id) || seen.has(id) || candidate.status !== 'published' || candidate.contentRating !== video.contentRating) return false;
    seen.add(id); return true;
  }).map(candidate => ({ ...candidate, matchedTags: candidate.tags.filter(tag => tags.has(tag)) }))
    .filter(candidate => candidate.matchedTags.length)
    .sort((a, b) => b.matchedTags.length - a.matchedTags.length ||
      new Date(b.publishedAt) - new Date(a.publishedAt) || String(b._id).localeCompare(String(a._id)))
    .slice(0, limit);
}
export function encodeCursor(video) {
  return Buffer.from(JSON.stringify({ t: new Date(video.publishedAt).toISOString(), i: String(video._id) })).toString('base64url');
}
export function decodeCursor(value) {
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpError(400, 'Invalid pagination cursor');
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (!/^\d{4}-\d{2}-\d{2}T/.test(data.t) || !Number.isFinite(Date.parse(data.t)) || !/^[a-f0-9]{24}$/.test(data.i)) throw new Error();
    return { publishedAt: new Date(data.t), _id: new mongoose.Types.ObjectId(data.i) };
  } catch { throw new HttpError(400, 'Invalid pagination cursor'); }
}

export function makeCatalog(database, cache, config) {
  const { Video, VideoSource, Category } = database;
  const query = q => q.maxTimeMS(config.queryTimeoutMs);
  const approvedSourceClauses = Object.entries(config.providerHosts).filter(([, hosts]) => hosts.length).flatMap(([provider, hosts]) => {
    const escaped = hosts.map(host => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`^https://(?:${escaped})(?::443)?(?:[/?#]|$)`, 'i');
    return [{ provider, kind: 'embed', embedUrl: pattern }, { provider, kind: 'direct', contentUrl: pattern }];
  });
  async function withPosterFallback(videos, sourceRows) {
    if (!videos.length || !approvedSourceClauses.length) return videos;
    const ids = new Set(videos.map(video => String(video._id)));
    const sources = sourceRows || await query(VideoSource.find({
      videoId: { $in: videos.map(video => video._id) }, enabled: true, status: 'ready',
      availability: { $ne: 'unavailable' }, 'providerMetadata.posterUrl': { $regex: '^https://' },
      $or: approvedSourceClauses,
    }).select('videoId provider kind embedUrl contentUrl priority providerMetadata.posterUrl').sort({ priority: 1, _id: 1 }).lean());
    const posters = new Map(), ordered = [...sources].sort((a, b) =>
      Number(b.provider === 'playmate') - Number(a.provider === 'playmate') || a.priority - b.priority || String(a._id).localeCompare(String(b._id)));
    for (const source of ordered) {
      const id = String(source.videoId), url = source.providerMetadata?.posterUrl;
      if (!ids.has(id) || !usableSource(source, config) || !safePosterUrl(url)) continue;
      const rows = posters.get(id) || [];
      if (!rows.some(row => row.provider === source.provider) && rows.length < 5) rows.push({ provider: source.provider, url });
      posters.set(id, rows);
    }
    return videos.map(video => {
      const rows = posters.get(String(video._id)) || [], current = video.thumbnail?.url || '';
      const url = current || rows[0]?.url || '';
      const host = value => { try { return new URL(value).hostname; } catch { return ''; } };
      const primaryHost = host(url), fallbackUrls = [...new Set(rows.map(row => row.url)
        .filter(candidate => candidate !== url && host(candidate) !== primaryHost))];
      if (!url) return video;
      const thumbnail = { ...video.thumbnail, url, alt: video.thumbnail?.alt || video.title || '' };
      if (fallbackUrls.length) thumbnail.fallbackUrls = fallbackUrls;
      return { ...video, thumbnail };
    });
  }
  async function cards(videos) { return (await withPosterFallback(videos)).map(card); }
  function card(video) {
    return { id: String(video._id), slug: video.slug, url: `/${video.slug}`, title: video.title,
      description: video.description?.slice(0, 300), thumbnail: video.thumbnail, tags: video.tags,
      durationSeconds: video.durationSeconds ?? null, contentRating: video.contentRating,
      quality: video.media?.quality ?? null, metrics: video.metrics,
      publishedAt: video.publishedAt, ...(video.matchedTags ? { matchedTags: video.matchedTags } : {}) };
  }
  async function recommendations(video) {
    const searchTags = video.tags.slice(0, 8);
    // Each indexed tag query returns a bounded recent candidate set. No whole-catalog sort.
    const batches = await Promise.all(searchTags.map(tag => query(Video.find({
      status: 'published', tags: tag, contentRating: video.contentRating, _id: { $ne: video._id },
    }).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 }).limit(24).lean())));
    const fallback = video.categories?.[0] ? await query(Video.find({ status: 'published', contentRating: video.contentRating,
      categories: video.categories[0], _id: { $ne: video._id } }).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 }).limit(48).lean()) : [];
    const candidates = [...new Map([...batches.flat(), ...fallback].map(v => [String(v._id), v])).values()];
    if (!candidates.length) return [];
    if (!approvedSourceClauses.length) return [];
    // Group in MongoDB: return candidate IDs rather than transferring up to 20 full URLs per candidate.
    const sources = await VideoSource.aggregate([
      { $match: { videoId: { $in: candidates.map(v => v._id) }, enabled: true, status: 'ready', availability: { $ne: 'unavailable' }, $or: approvedSourceClauses } },
      { $group: { _id: '$videoId' } },
    ]).option({ maxTimeMS: config.queryTimeoutMs });
    const playable = new Set(sources.map(source => String(source._id)));
    const eligible = candidates.filter(v => playable.has(String(v._id)));
    const matched = rankRecommendations(eligible, video, 16);
    const selected = new Set(matched.map(v => String(v._id)));
    const recent = fallback.filter(v => playable.has(String(v._id)) && !selected.has(String(v._id)));
    return cards([...matched, ...recent].slice(0, 16));
  }
  return {
    card, cards, withPosterFallback,
    async navigation(rating = 'general') {
      return cache.getOrLoad(`navigation:${rating}`, async () => {
        const rows = await query(Category.find({ status: 'active', contentRating: rating })
          .select('slug name -_id').sort({ slug: 1 }).limit(500).lean());
        return { categories: rows.map(row => ({ slug: row.slug, name: row.name })) };
      });
    },
    async tag(slug, { page = 1, rating = 'general' } = {}) {
      return cache.getOrLoad(`tag-numbered:${slug}:${rating}:${page}`, async () => {
        const filter = { tags: slug, status: 'published', contentRating: rating };
        const totalVideos = await query(Video.countDocuments(filter));
        if (!totalVideos) return null;
        const pageCount = Math.min(1000, Math.ceil(totalVideos / 25));
        if (page > pageCount) return null;
        const rows = await query(Video.find(filter).select(CARD_FIELDS)
          .sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).lean());
        return { tag: { slug, name: slug.replace(/-/g, ' '), contentRating: rating }, videos: await cards(rows),
          pagination: { currentPage: page, pageCount, totalVideos, pageSize: 25 } };
      });
    },
    async page(slug) {
      return cache.getOrLoad(`page:v3:${slug}`, async () => {
        const video = await query(Video.findOne({ slug, status: 'published' }).select('-__v').lean());
        if (!video) return null;
        const [sources, recommended, categories] = await Promise.all([
          query(VideoSource.find({ videoId: video._id, enabled: true, status: 'ready' }).select(SOURCE_FIELDS).sort({ priority: 1, _id: 1 }).limit(20).lean()),
          recommendations(video),
          query(Category.find({ slug: { $in: video.categories }, status: 'active', contentRating: video.contentRating }).select('slug name').limit(12).lean()),
        ]);
        const ordered = orderSources(sources, config);
        const [preparedVideo] = await withPosterFallback([video], ordered);
        return {
          video: { ...preparedVideo, _id: String(video._id), canonicalUrl: `${config.publicSiteOrigin || config.siteOrigin}/${video.slug}` },
          sources: ordered.map(source => ({ id: String(source._id), provider: source.provider, kind: source.kind,
            url: source.kind === 'embed' ? source.embedUrl : source.contentUrl, priority: source.priority })),
          selectedSourceId: ordered.length ? String(ordered[0]._id) : null,
          categories: categories.map(category => ({ slug: category.slug, name: category.name, url: `/categories/${category.slug}` })),
          recommendations: recommended, recommendationStrategy: 'bounded-tag-overlap-then-primary-category-recency',
        };
      });
    },
    async list({ limit = 24, cursor, tag, category, rating = 'general' }) {
      const after = cursor ? decodeCursor(cursor) : null;
      const filter = { status: 'published', contentRating: rating, ...(tag ? { tags: tag } : {}),
        ...(category ? { categories: category } : {}),
        ...(after ? { $or: [{ publishedAt: { $lt: after.publishedAt } }, { publishedAt: after.publishedAt, _id: { $lt: after._id } }] } : {}) };
      return cache.getOrLoad(`list:${limit}:${cursor || ''}:${tag || ''}:${rating}:${category || ''}`, async () => {
        const rows = await query(Video.find(filter).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 }).limit(limit + 1).lean());
        const hasMore = rows.length > limit, page = rows.slice(0, limit);
        return { videos: await cards(page), nextCursor: hasMore ? encodeCursor(page.at(-1)) : null };
      });
    },
    async categories({ limit = 24, cursor, rating = 'general' } = {}) {
      return cache.getOrLoad(`categories:v2:${limit}:${cursor || ''}:${rating}`, async () => {
        const rows = await query(Category.find({ status: 'active', contentRating: rating,
          ...(cursor ? { slug: { $gt: cursor } } : {}) }).select('-__v -bodyText').sort({ slug: 1 }).limit(limit + 1).lean());
        const page = rows.slice(0, limit);
        if (!page.length) return { categories: [], nextCursor: null };
        const slugs = page.map(row => row.slug);
        const counts = await Video.aggregate([
          { $match: { status: 'published', contentRating: rating, categories: { $in: slugs } } },
          { $unwind: '$categories' },
          { $match: { categories: { $in: slugs } } },
          { $group: { _id: '$categories', count: { $sum: 1 } } },
        ]).option({ maxTimeMS: config.queryTimeoutMs });
        const totals = new Map(counts.map(row => [row._id, row.count]));
        // Use category_listing index; bounded batches avoid 48 simultaneous queries.
        const latest = new Map(), latestRows = [];
        for (let offset = 0; offset < page.length; offset += 8) {
          await Promise.all(page.slice(offset, offset + 8).map(async row => {
            const video = await query(Video.findOne({ categories: row.slug, status: 'published', contentRating: rating })
              .select('thumbnail title').sort({ publishedAt: -1, _id: -1 }).lean());
            if (video) latestRows.push({ slug: row.slug, name: row.name, video });
          }));
        }
        const preparedLatest = await withPosterFallback(latestRows.map(row => row.video));
        for (let i = 0; i < latestRows.length; i++) {
          const { slug, name } = latestRows[i], video = preparedLatest[i];
          latest.set(slug, video.thumbnail?.url ? { ...video.thumbnail, alt: video.thumbnail.alt || video.title || name } : {});
        }
        return { categories: page.map(row => ({ ...row, _id: String(row._id), url: `/category/${row.slug}/`,
          thumbnail: latest.get(row.slug), videoCount: totals.get(row.slug) || 0 })),
          nextCursor: rows.length > limit ? rows[limit - 1].slug : null };
      });
    },
    async category(slug, options = {}) {
      const category = await cache.getOrLoad(`category:${slug}`, () =>
        query(Category.findOne({ slug, status: 'active' }).select('-__v').lean()));
      if (!category) return null;
      let listing;
      if (options.page !== undefined) {
        const limit = options.limit || 25;
        listing = await cache.getOrLoad(`category-numbered:${slug}:${limit}:${options.page}`, async () => {
          const filter = { categories: slug, status: 'published', contentRating: category.contentRating };
          const totalVideos = await query(Video.countDocuments(filter));
          const totalPages = Math.max(1, Math.ceil(totalVideos / limit));
          const pageCount = Math.min(1000, totalPages);
          const currentPage = Math.min(options.page, pageCount);
          const rows = await query(Video.find(filter).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 })
            .skip((currentPage - 1) * limit).limit(limit).lean());
          return { videos: await cards(rows), nextCursor: currentPage < totalPages && rows.length ? encodeCursor(rows.at(-1)) : null,
            pagination: { currentPage, pageCount, totalVideos, pageSize: limit, hasMoreViaCursor: totalPages > pageCount } };
        });
      } else {
        listing = await this.list({ ...options, category: slug, rating: category.contentRating });
      }
      return { category: { ...category, _id: String(category._id), canonicalUrl: `${config.siteOrigin}/category/${slug}/` }, ...listing };
    },
    async validateCategories(video) {
      if (!video.categories.length) return;
      const rows = await query(Category.find({ slug: { $in: video.categories }, status: 'active', contentRating: video.contentRating }).select('slug').lean());
      if (rows.length !== video.categories.length) throw new HttpError(409, 'Publishing requires active categories matching the video content rating');
    },
    async publishable(videoId) {
      const sources = await query(VideoSource.find({ videoId, enabled: true, status: 'ready' }).limit(21).lean());
      if (!sources.some(source => usableSource(source, config))) throw new HttpError(409, 'Publishing requires an enabled ready source on an approved provider hostname');
    },
    async sourceCount(videoId) { return query(VideoSource.countDocuments({ videoId })); },
  };
}
