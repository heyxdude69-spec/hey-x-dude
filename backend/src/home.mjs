import mongoose from 'mongoose';
import { z } from 'zod';
import { SLUG_PATTERN } from './models.mjs';
import { makeCatalog, HttpError } from './catalog.mjs';
const text = max => z.string().trim().min(1).max(max);
const sectionInput = z.object({ key: text(80).regex(SLUG_PATTERN), title: text(150), type: z.enum(['latest', 'category', 'popular', 'quality']),
  categorySlug: text(80).regex(SLUG_PATTERN).optional(), qualities: z.array(z.enum(['sd', 'hd', 'fullhd', 'uhd'])).min(1).max(4).optional(),
  limit: z.number().int().min(1).max(48), collectionPageSize: z.number().int().min(1).max(48), windowSize: z.number().int().min(1).max(500), order: z.number().int().min(0).max(1000),
  enabled: z.boolean(), paginate: z.boolean(), badgeText: z.string().trim().max(80), seeMoreLabel: text(80),
}).strict().superRefine((row, ctx) => {
  if (row.windowSize < Math.max(row.limit, row.collectionPageSize)) ctx.addIssue({ code: 'custom', message: 'windowSize must cover page sizes' });
  if (row.type === 'category' && !row.categorySlug) ctx.addIssue({ code: 'custom', message: 'Category section needs categorySlug' });
  if (row.type === 'quality' && !row.qualities?.length) ctx.addIssue({ code: 'custom', message: 'Quality section needs qualities' });
});
export const homeSettingsInput = z.object({ key: z.literal('homepage'), contentRating: z.enum(['general', 'adult']),
  seo: z.object({ title: text(300), metaDescription: text(1000), indexAllowed: z.boolean() }).strict(),
  fallbackCategoryLabel: text(100), emptyMessage: text(300), sections: z.array(sectionInput).min(1).max(12),
}).strict().superRefine((row, ctx) => {
  if (new Set(row.sections.map(section => section.key)).size !== row.sections.length) ctx.addIssue({ code: 'custom', message: 'Section keys must be unique' });
});
const sectionSchema = new mongoose.Schema({ key: String, title: String, type: { type: String, enum: ['latest', 'category', 'popular', 'quality'] },
  categorySlug: String, qualities: { type: [String], default: undefined }, limit: Number, collectionPageSize: Number, windowSize: Number,
  order: Number, enabled: Boolean, paginate: Boolean, badgeText: String, seeMoreLabel: String,
}, { _id: false, strict: 'throw' });
const settingsSchema = new mongoose.Schema({ key: { type: String, required: true, enum: ['homepage'] },
  contentRating: { type: String, enum: ['general', 'adult'], required: true },
  seo: { type: new mongoose.Schema({ title: String, metaDescription: String, indexAllowed: Boolean }, { _id: false, strict: 'throw' }), required: true },
  fallbackCategoryLabel: String, emptyMessage: String, sections: { type: [sectionSchema], required: true },
}, { collection: 'homepage_settings', strict: 'throw', timestamps: true, autoIndex: false, autoCreate: false });
settingsSchema.index({ key: 1 }, { unique: true, name: 'unique_homepage_settings' });
export function homeModel(connection) { return connection.models.HomepageSettings || connection.model('HomepageSettings', settingsSchema); }
export async function setupHome(database) {
  const Settings = homeModel(database.connection);
  const string = { bsonType: 'string' }, number = { bsonType: ['int', 'double'], multipleOf: 1 };
  const section = { bsonType: 'object', additionalProperties: false,
    required: ['key', 'title', 'type', 'limit', 'collectionPageSize', 'windowSize', 'order', 'enabled', 'paginate', 'badgeText', 'seeMoreLabel'],
    properties: { key: { ...string, pattern: SLUG_PATTERN.source, maxLength: 80 }, title: { ...string, minLength: 1, maxLength: 150 },
      type: { enum: ['latest', 'category', 'popular', 'quality'] }, categorySlug: { ...string, pattern: SLUG_PATTERN.source },
      qualities: { bsonType: 'array', minItems: 1, maxItems: 4, items: { enum: ['sd','hd','fullhd','uhd'] } },
      limit: { ...number, minimum: 1, maximum: 48 }, collectionPageSize: { ...number, minimum: 1, maximum: 48 },
      windowSize: { ...number, minimum: 1, maximum: 500 }, order: { ...number, minimum: 0, maximum: 1000 },
      enabled: { bsonType: 'bool' }, paginate: { bsonType: 'bool' }, badgeText: { ...string, maxLength: 80 }, seeMoreLabel: { ...string, minLength: 1, maxLength: 80 } } };
  const validator = { $jsonSchema: { bsonType: 'object', additionalProperties: false,
    required: ['key','contentRating','seo','fallbackCategoryLabel','emptyMessage','sections'], properties: {
      _id: { bsonType: 'objectId' }, __v: { bsonType: 'int' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
      key: { enum: ['homepage'] }, contentRating: { enum: ['general','adult'] },
      seo: { bsonType: 'object', additionalProperties: false, required: ['title','metaDescription','indexAllowed'], properties: {
        title: { ...string, minLength: 1, maxLength: 300 }, metaDescription: { ...string, minLength: 1, maxLength: 1000 }, indexAllowed: { bsonType: 'bool' } } },
      fallbackCategoryLabel: { ...string, minLength: 1, maxLength: 100 }, emptyMessage: { ...string, minLength: 1, maxLength: 300 },
      sections: { bsonType: 'array', minItems: 1, maxItems: 12, items: section },
    } } };
  await Settings.createCollection({ validator, validationLevel: 'strict', validationAction: 'error' });
  await database.connection.db.command({ collMod: 'homepage_settings', validator, validationLevel: 'strict', validationAction: 'error' });
  await Settings.createIndexes();
  await database.Video.collection.createIndex({ status: 1, contentRating: 1, 'metrics.views': -1, publishedAt: -1, _id: -1 }, { name: 'home_popular' });
  await database.Video.collection.createIndex({ status: 1, contentRating: 1, 'media.quality': 1, publishedAt: -1, _id: -1 }, { name: 'home_quality' });
}
export function homeFilter(section, rating) { return { status: 'published', contentRating: rating,
  ...(section.type === 'category' ? { categories: section.categorySlug } : {}),
  ...(section.type === 'quality' ? { 'media.quality': { $in: section.qualities } } : {}) }; }
export function homeSort(section) { return section.type === 'popular' ? { 'metrics.views': -1, publishedAt: -1, _id: -1 } : { publishedAt: -1, _id: -1 }; }
const fields = 'slug title description thumbnail tags categories durationSeconds media.quality metrics publishedAt';
export function makeHome(database, cache, config, Settings = homeModel(database.connection)) {
  const catalog = makeCatalog(database, cache, config), query = q => q.maxTimeMS(config.queryTimeoutMs);
  const approved = Object.entries(config.providerHosts).flatMap(([provider, hosts]) => {
    if (!hosts.length) return [];
    const pattern = new RegExp(`^https://(?:${hosts.map(host => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?::443)?(?:[/?#]|$)`, 'i');
    return [{ provider, kind: 'embed', embedUrl: pattern }, { provider, kind: 'direct', contentUrl: pattern }];
  });
  async function feed(section, rating, page) {
    page = section.paginate ? Math.min(page, Math.ceil(section.windowSize / section.limit)) : 1;
    return cache.getOrLoad(`home-feed:v1:${JSON.stringify(section)}:${rating}:${page}`, async () => {
      if (section.type === 'category' && !await query(database.Category.exists({ slug: section.categorySlug, status: 'active', contentRating: rating }))) {
        return { ...section, videos: [], pagination: { currentPage: 1, pageCount: 1 }, seeMoreUrl: `/categories/${section.categorySlug}` };
      }
      const candidates = await query(database.Video.find(homeFilter(section, rating)).select(fields).sort(homeSort(section)).limit(section.windowSize).lean());
      const sources = candidates.length && approved.length ? await database.VideoSource.aggregate([
        { $match: { videoId: { $in: candidates.map(row => row._id) }, enabled: true, status: 'ready', availability: { $ne: 'unavailable' }, $or: approved } },
        { $group: { _id: '$videoId' } },
      ]).option({ maxTimeMS: config.queryTimeoutMs }) : [];
      const ready = new Set(sources.map(row => String(row._id))), eligible = candidates.filter(row => ready.has(String(row._id)));
      const pageCount = section.paginate ? Math.max(1, Math.ceil(eligible.length / section.limit)) : 1;
      const currentPage = Math.min(page, pageCount), start = section.paginate ? (currentPage - 1) * section.limit : 0;
      const videos = eligible.slice(start, start + section.limit).map(row => ({ ...catalog.card(row), categories: row.categories || [] }));
      return { ...section, videos, pagination: { currentPage, pageCount }, seeMoreUrl: section.type === 'category' ? `/categories/${section.categorySlug}` : section.type === 'quality' ? `/collections/${section.key}` : `/?section=${section.key}` };
    });
  }
  async function qualityCollection(section, rating, page) {
    return cache.getOrLoad(`quality-collection:v1:${JSON.stringify(section)}:${rating}:${page}`, async () => {
      const size = section.collectionPageSize;
      const projection = Object.fromEntries(fields.split(' ').map(field => [field, 1]));
      const result = await database.Video.aggregate([
        { $match: homeFilter(section, rating) }, { $sort: homeSort(section) },
        { $lookup: { from: 'video_sources', let: { video: '$_id' }, pipeline: [
          { $match: { $expr: { $eq: ['$videoId', '$$video'] }, enabled: true, status: 'ready', availability: { $ne: 'unavailable' }, $or: approved.length ? approved : [{ _id: null }] } },
          { $limit: 1 }, { $project: { _id: 1 } }
        ], as: 'playable' } },
        { $match: { 'playable.0': { $exists: true } } },
        { $facet: { total: [{ $count: 'count' }], rows: [{ $skip: (page - 1) * size }, { $limit: size }, { $project: projection }] } }
      ]).option({ maxTimeMS: config.queryTimeoutMs });
      const total = result[0]?.total[0]?.count || 0;
      const pageCount = Math.max(1, Math.ceil(total / size));
      if (page > pageCount) throw new HttpError(404, 'Collection page not found');
      return { ...section, paginate: true, videos: (result[0]?.rows || []).map(row => ({ ...catalog.card(row), categories: row.categories || [] })),
        pagination: { currentPage: page, pageCount }, seeMoreUrl: `/collections/${section.key}` };
    });
  }
  return { async get({ section, page = 1 } = {}) {
    const raw = await cache.getOrLoad('homepage-settings:v1', () => query(Settings.findOne({ key: 'homepage' }).select('-_id -__v -createdAt -updatedAt').lean()));
    if (!raw) throw new HttpError(503, 'Homepage settings are not initialized');
    const settings = homeSettingsInput.parse(raw), enabled = settings.sections.filter(row => row.enabled).sort((a,b) => a.order - b.order || a.key.localeCompare(b.key));
    const selected = section ? enabled.filter(row => row.key === section) : enabled;
    if (section && !selected.length) throw new HttpError(404, 'Home collection not found');
    const sections = [];
    for (let offset = 0; offset < selected.length; offset += 4) sections.push(...await Promise.all(selected.slice(offset, offset + 4).map(row => section && row.type === 'quality' ? qualityCollection(row, settings.contentRating, page) : feed(section ? { ...row, limit: row.collectionPageSize, paginate: true } : row.type === 'quality' ? { ...row, limit: 8, paginate: false } : row, settings.contentRating, page))));
    const slugs = [...new Set(sections.flatMap(row => row.videos.flatMap(video => video.categories)))];
    const categories = slugs.length ? await query(database.Category.find({ slug: { $in: slugs }, status: 'active', contentRating: settings.contentRating }).select('slug name').limit(500).lean()) : [];
    const names = new Map(categories.map(row => [row.slug, row.name]));
    for (const row of sections) for (const video of row.videos) video.categoryName = names.get(video.categories[0]) || settings.fallbackCategoryLabel;
    return { seo: settings.seo, contentRating: settings.contentRating, emptyMessage: settings.emptyMessage, selectedSection: section || null, sections };
  } };
}
