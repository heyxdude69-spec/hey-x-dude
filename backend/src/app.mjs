import express from 'express';
import helmet from 'helmet';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { approvedUrl } from './config.mjs';
import { HttpError, makeCatalog } from './catalog.mjs';
import { RequestLimiter } from './cache.mjs';
import { normalizeTags, SLUG_PATTERN } from './models.mjs';
import { videoCreate, videoUpdate, sourceCreate, sourceUpdate, categoryCreate, categoryUpdate, requireId } from './validation.mjs';
import { renderPage, renderListing, renderCategories, renderCategory } from './render.mjs';
import { buildDirectorySeo, buildCategorySeo, buildVideoSeo } from './page-seo.mjs';
import { makeInteractions } from './interactions.mjs';
import { makeHome } from './home.mjs';
import { makeSearch } from './search.mjs';

export function createApp({ database, cache, config, logRequests = true }) {
  const app = express(), catalog = makeCatalog(database, cache, config), limiter = new RequestLimiter(cache, config);
  const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
  const approvedHosts = [...new Set(Object.values(config.providerHosts).flat())].map(host => `https://${host}`);
  app.disable('x-powered-by'); app.set('trust proxy', config.trustProxyHops);
  app.use(helmet({ crossOriginEmbedderPolicy: false, strictTransportSecurity: config.mode === 'production' ? undefined : false,
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
      imgSrc: ["'self'", 'https:', 'data:'], frameSrc: ["'self'", ...approvedHosts], mediaSrc: ["'self'", ...approvedHosts],
      upgradeInsecureRequests: config.mode === 'production' ? [] : null } } }));
  let active = 0;
  app.use((req, res, next) => {
    req.requestId = randomUUID(); res.set('X-Request-Id', req.requestId);
    if (req.path.startsWith('/health/')) return next();
    if (active >= config.maxConcurrent) return res.status(503).set('Retry-After', '2').json({ error: 'Server busy; retry shortly' });
    active++; const started = performance.now(); let released = false;
    const release = () => {
      if (released) return; released = true; active--;
      if (logRequests) console.log(JSON.stringify({ requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, milliseconds: Math.round(performance.now() - started) }));
    };
    res.once('finish', release); res.once('close', release); next();
  });
  app.get('/health/live', (_req, res) => res.json({ status: 'up' }));
  app.get('/health/ready', (_req, res) => {
    const ready = database.connection.readyState === 1 && (config.mode !== 'production' || cache.mode === 'redis+l1');
    res.status(ready ? 200 : 503).set('Cache-Control', 'no-store').json({ status: ready ? 'ready' : 'degraded', cache: cache.mode });
  });
  app.use(async (req, res, next) => {
    const expected = Buffer.from(config.interactionSecret || ''), supplied = Buffer.from(req.get('X-Interaction-Secret') || '');
    const visitor = req.get('X-Visitor-Id') || '';
    const serviceAuthenticated = expected.length >= 32 && expected.length === supplied.length && timingSafeEqual(expected, supplied);
    if (serviceAuthenticated && req.method === 'GET' && req.path === '/api/home') return next();
    if (serviceAuthenticated && req.method === 'GET' && req.path === '/api/navigation') return next();
    if (serviceAuthenticated && req.method === 'GET' && /^\/api\/tags\/[^/]+\/videos$/.test(req.path)) return next();
    // Server-rendered public reads share the Next.js server IP. Keep concurrency
    // bounds and cache protection without treating every visitor as one client.
    if (serviceAuthenticated && req.method === 'GET' && /^\/api\/(?:categories(?:\/[a-z0-9-]+\/videos)?|videos(?:\/[a-z0-9-]+)?)$/.test(req.path)) return next();
    const trusted = serviceAuthenticated && /^[a-f0-9-]{36}$/i.test(visitor);
    const key = trusted ? `proxy-visitor:${visitor}` : req.ip;
    if (!await limiter.allow(key, req.path.startsWith('/api/admin/'))) return res.status(429).set('Retry-After', '60').json({ error: 'Request limit reached' });
    next();
  });
  app.use('/assets', express.static(`${publicDirectory}/assets`, { maxAge: '1h', fallthrough: false }));
  app.use(express.json({ limit: '160kb', strict: true }));
  const publicCache = res => res.set('Cache-Control', `public, max-age=0, s-maxage=${config.publicCacheSeconds}, must-revalidate`);
  function listingOptions(req) {
    const raw = z.object({ limit: z.coerce.number().int().min(1).max(48).optional(), cursor: z.string().max(256).optional(),
      tag: z.string().max(80).optional(), rating: z.enum(['general', 'adult']).optional() }).strict().parse(req.query);
    const tag = raw.tag ? normalizeTags([raw.tag])[0] : undefined;
    if (raw.tag && !tag) throw new HttpError(400, 'Invalid tag');
    return { limit: raw.limit || 24, cursor: raw.cursor, tag, rating: raw.rating || 'general' };
  }
  app.get('/', async (req, res) => {
    const options = listingOptions(req), result = await catalog.list(options);
    publicCache(res).type('html').send(renderListing(result, config, options));
  });
  app.get('/api/videos', async (req, res) => publicCache(res).json(await catalog.list(listingOptions(req))));
  const searchCatalog = makeSearch(database, cache, config);
  app.get('/api/search', async (req, res) => {
    const { q, rating, page } = z.object({ q: z.string().max(100).default(''), rating: z.enum(['general', 'adult']).default('general'), page: z.coerce.number().int().min(1).max(100).optional() }).strict().parse(req.query);
    publicCache(res).json(await searchCatalog(q, rating, page ?? null));
  });
  app.get('/api/navigation', async (req, res) => {
    const { rating } = z.object({ rating: z.enum(['general', 'adult']).default('general') }).strict().parse(req.query);
    publicCache(res).json(await catalog.navigation(rating));
  });
  app.get('/api/tags/:slug/videos', async (req, res) => {
    const slug = req.params.slug;
    if (slug.length > 80 || normalizeTags([slug])[0] !== slug) throw new HttpError(400, 'Invalid tag slug');
    const options = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1),
      rating: z.enum(['general', 'adult']).default('general') }).strict().parse(req.query);
    const result = await catalog.tag(slug, options);
    if (!result) throw new HttpError(404, 'Tag or page not found');
    publicCache(res).json(result);
  });
  let home;
  app.get('/api/home', async (req, res) => {
    const options = z.object({ section: z.string().max(80).regex(SLUG_PATTERN).optional(), page: z.coerce.number().int().min(1).max(1000000).optional() }).strict().parse(req.query);
    home ||= makeHome(database, cache, config);
    publicCache(res).json(await home.get(options));
  });
  function categoryOptions(req, directory = false) {
    return z.object({ limit: z.coerce.number().int().min(1).max(48).optional(),
      cursor: directory ? z.string().max(80).regex(SLUG_PATTERN).optional() : z.string().max(256).optional(),
      ...(!directory ? { page: z.coerce.number().int().min(1).max(1000).optional() } : {}),
      ...(directory ? { rating: z.enum(['general', 'adult']).optional() } : {}),
    }).strict().refine(value => !('page' in value && value.page && value.cursor), 'Use page or cursor, not both').parse(req.query);
  }
  async function directoryResult(options) {
    const result = await catalog.categories(options);
    return { ...result, seo: buildDirectorySeo(result, config, options) };
  }
  app.get('/api/categories', async (req, res) => publicCache(res).json(await directoryResult(categoryOptions(req, true))));
  app.get('/categories/', async (req, res) => {
    const options = categoryOptions(req, true);
    publicCache(res).type('html').send(renderCategories(await directoryResult(options), config, options));
  });
  async function categoryResult(req) {
    if (req.params.slug.length > 80 || !SLUG_PATTERN.test(req.params.slug)) throw new HttpError(400, 'Invalid category slug');
    const options = categoryOptions(req), result = await catalog.category(req.params.slug, options);
    if (!result) throw new HttpError(404, 'Category not found');
    return { result: { ...result, seo: buildCategorySeo(result, config, options) }, options };
  }
  app.get('/api/categories/:slug/videos', async (req, res) => {
    const { result } = await categoryResult(req); publicCache(res).json(result);
  });
  app.get('/category/:slug/', async (req, res) => {
    const { result, options } = await categoryResult(req);
    publicCache(res).type('html').send(renderCategory(result, options, config));
  });
  app.get('/api/videos/:slug', async (req, res) => {
    if (!SLUG_PATTERN.test(req.params.slug) || req.params.slug.length > 180) throw new HttpError(400, 'Invalid slug');
    const page = await catalog.page(req.params.slug);
    if (!page) throw new HttpError(404, 'Video not found');
    page.seo = buildVideoSeo(page, config);
    if (!page.sources.length) res.status(503).set('Retry-After', '300').set('Cache-Control', 'no-store').json(page);
    else publicCache(res).json(page);
  });
  let interactions;
  function interactionAccess(req, res) {
    res.set('Cache-Control', 'no-store');
    const expected = Buffer.from(config.interactionSecret || ''), supplied = Buffer.from(req.get('X-Interaction-Secret') || '');
    if (expected.length < 32) throw new HttpError(503, 'Interaction service is not configured');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new HttpError(401, 'Interaction proxy authentication required');
    if (!SLUG_PATTERN.test(req.params.slug) || req.params.slug.length > 180) throw new HttpError(400, 'Invalid slug');
    const visitor = z.string().uuid().parse(req.get('X-Visitor-Id'));
    interactions ||= makeInteractions(database, config);
    return visitor;
  }
  app.get('/api/videos/:slug/interactions', async (req, res) => res.json(await interactionsFor(req, res)));
  async function interactionsFor(req, res) { const visitor = interactionAccess(req, res); return interactions.get(req.params.slug, visitor); }
  app.post('/api/videos/:slug/interactions', async (req, res) => {
    const visitor = interactionAccess(req, res);
    if (!await limiter.allow(`visitor:${visitor}`, true)) throw new HttpError(429, 'Interaction request limit reached');
    const input = z.discriminatedUnion('action', [z.object({ action: z.literal('view') }).strict(),
      z.object({ action: z.literal('vote'), vote: z.enum(['like', 'dislike']).nullable() }).strict()]).parse(req.body);
    res.json(await interactions.update(req.params.slug, visitor, input.action, input.vote));
  });
  app.get('/api/videos/:slug/comments', async (req, res) => {
    interactionAccess(req, res);
    const input = z.object({ before: z.string().regex(/^[a-f0-9]{24}$/).optional() }).strict().parse(req.query);
    res.json(await interactions.comments(req.params.slug, input.before));
  });
  app.post('/api/videos/:slug/comments', async (req, res) => {
    const visitor = interactionAccess(req, res);
    if (!await limiter.allow(`visitor:${visitor}`, true)) throw new HttpError(429, 'Interaction request limit reached');
    const input = z.object({ name: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(2000), requestId: z.string().uuid() }).strict().parse(req.body);
    res.status(201).json(await interactions.submit(req.params.slug, visitor, input));
  });
  app.get('/videos/:slug/', async (req, res) => {
    if (!SLUG_PATTERN.test(req.params.slug) || req.params.slug.length > 180) throw new HttpError(400, 'Invalid slug');
    const page = await catalog.page(req.params.slug);
    if (!page) throw new HttpError(404, 'Video not found');
    page.seo = buildVideoSeo(page, config);
    if (!page.sources.length) res.status(503).set('Retry-After', '300').set('X-Robots-Tag', 'noindex');
    if (!page.video.seo.indexAllowed) res.set('X-Robots-Tag', 'noindex');
    if (!page.sources.length) res.set('Cache-Control', 'no-store');
    else publicCache(res);
    res.type('html').send(renderPage(page, config));
  });
  app.get('/robots.txt', (_req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${config.siteOrigin}/sitemap.xml\n`));
  app.get('/sitemap.xml', (_req, res, next) => res.set('Cache-Control', 'public, max-age=300').sendFile(`${publicDirectory}/sitemaps/index.xml`, error => error && next(error)));
  app.use('/sitemaps', express.static(`${publicDirectory}/sitemaps`, { maxAge: '5m', index: false, fallthrough: false }));
  app.use('/api/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const expected = Buffer.from(config.adminToken), supplied = Buffer.from((req.get('Authorization') || '').replace(/^Bearer /, ''));
    if (expected.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new HttpError(401, 'Valid admin bearer token required');
    next();
  });
  app.get('/api/admin/stats', (_req, res) => res.json({ activeRequests: active, cache: cache.mode, cacheStats: cache.stats }));
  app.post('/api/admin/categories', async (req, res) => {
    const category = await database.Category.create(categoryCreate.parse(req.body));
    await cache.invalidate(); res.status(201).json({ category });
  });
  app.patch('/api/admin/categories/:id', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid category ID');
    const input = categoryUpdate.parse(req.body);
    const category = await database.Category.findById(req.params.id).maxTimeMS(config.queryTimeoutMs);
    if (!category) throw new HttpError(404, 'Category not found');
    for (const [key, value] of Object.entries(input)) {
      if (key === 'seo' || key === 'thumbnail') {
        for (const [leaf, data] of Object.entries(value)) category.set(`${key}.${leaf}`, data);
      } else category.set(key, value);
    }
    await category.save(); await cache.invalidate(); res.json({ category });
  });
  app.get('/api/admin/videos', async (req, res) => {
    const options = z.object({ status: z.enum(['draft', 'published', 'archived']).optional(),
      limit: z.coerce.number().int().min(1).max(48).optional(), cursor: z.string().regex(/^[a-f0-9]{24}$/).optional() }).strict().parse(req.query);
    const limit = options.limit || 24;
    const rows = await database.Video.find({ ...(options.status ? { status: options.status } : {}),
      ...(options.cursor ? { _id: { $lt: options.cursor } } : {}) })
      .select('slug title status tags createdAt updatedAt').sort({ _id: -1 }).limit(limit + 1).maxTimeMS(config.queryTimeoutMs).lean();
    res.json({ videos: rows.slice(0, limit), nextCursor: rows.length > limit ? String(rows[limit - 1]._id) : null });
  });
  app.get('/api/admin/videos/:id', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid video ID');
    const video = await database.Video.findById(req.params.id).select('+importReference').maxTimeMS(config.queryTimeoutMs).lean();
    if (!video) throw new HttpError(404, 'Video not found');
    const sources = await database.VideoSource.find({ videoId: video._id }).sort({ priority: 1, _id: 1 }).maxTimeMS(config.queryTimeoutMs).lean();
    res.json({ video, sources });
  });
  app.post('/api/admin/videos', async (req, res) => {
    const input = videoCreate.parse(req.body);
    if (input.status === 'published') throw new HttpError(409, 'Create a draft, add a ready source, then publish');
    const video = await database.Video.create(input); await cache.invalidate();
    res.status(201).json({ video });
  });
  app.patch('/api/admin/videos/:id', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid video ID');
    const input = videoUpdate.parse(req.body);
    const video = await database.Video.findById(req.params.id).maxTimeMS(config.queryTimeoutMs);
    if (!video) throw new HttpError(404, 'Video not found');
    for (const [key, value] of Object.entries(input)) {
      if (key === 'seo' || key === 'thumbnail' || key === 'media' || key === 'metrics') {
        for (const [leaf, data] of Object.entries(value)) video.set(`${key}.${leaf}`, data);
      } else video.set(key, value);
    }
    if (video.status === 'published') {
      await catalog.publishable(video._id);
      await catalog.validateCategories(video);
      video.publishedAt ||= new Date();
    }
    await video.save(); await cache.invalidate(); res.json({ video });
  });
  function validateReadySource(source) {
    if (source.enabled && source.status === 'ready' && !approvedUrl(source.kind === 'embed' ? source.embedUrl : source.contentUrl, source.provider, config)) {
      throw new HttpError(400, 'Ready source hostname must be configured in PROVIDER_HOSTS_JSON');
    }
  }
  app.post('/api/admin/videos/:id/sources', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid video ID');
    const input = sourceCreate.parse(req.body);
    if (!await database.Video.exists({ _id: req.params.id }).maxTimeMS(config.queryTimeoutMs)) throw new HttpError(404, 'Video not found');
    let source;
    for (let attempt = 0; attempt < 4; attempt++) {
      const used = new Set((await database.VideoSource.find({ videoId: req.params.id }).select('slot').lean()).map(s => s.slot));
      const slot = Array.from({ length: 20 }, (_, i) => i).find(i => !used.has(i));
      if (slot === undefined) throw new HttpError(409, 'Maximum 20 sources per video reached');
      source = new database.VideoSource({ ...input, videoId: req.params.id, slot }); validateReadySource(source);
      try { await source.save(); break; }
      catch (error) { if (error.code === 11000 && error.keyPattern?.slot && attempt < 3) continue; throw error; }
    }
    await cache.invalidate(); res.status(201).json({ source });
  });
  app.patch('/api/admin/sources/:id', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid source ID');
    const input = sourceUpdate.parse(req.body);
    const source = await database.VideoSource.findById(req.params.id).maxTimeMS(config.queryTimeoutMs);
    if (!source) throw new HttpError(404, 'Source not found');
    source.set(input); validateReadySource(source); await source.save(); await cache.invalidate(); res.json({ source });
  });
  app.delete('/api/admin/sources/:id', async (req, res) => {
    if (!requireId(req.params.id)) throw new HttpError(400, 'Invalid source ID');
    const removed = await database.VideoSource.findByIdAndDelete(req.params.id).maxTimeMS(config.queryTimeoutMs);
    if (!removed) throw new HttpError(404, 'Source not found');
    await cache.invalidate(); res.json({ deletedSourceId: String(removed._id) });
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use((error, req, res, _next) => {
    let status = error.status || 500, message = error.message;
    if (error instanceof z.ZodError) { status = 400; message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '); }
    else if (error.name === 'ValidationError') { status = 400; message = `Invalid document fields: ${Object.keys(error.errors).join(', ')}`; }
    else if (error.name === 'StrictModeError' || error.name === 'CastError' || error.code === 121) { status = 400; message = 'Invalid document data'; }
    else if (error.code === 'ENOENT') { status = 404; message = 'Not found'; }
    else if (error.name === 'VersionError' || error.code === 11000) { status = 409; message = 'Conflicting update or duplicate slug/provider file'; }
    else if (error.code === 50 || error.name?.includes('MongoServerSelection') || error.name?.includes('MongoNetwork')) { status = 503; message = 'Database temporarily unavailable'; }
    if (status >= 500) console.error(JSON.stringify({ requestId: req.requestId, errorType: error.name, code: error.code }));
    res.status(status).set('Cache-Control', 'no-store').json({ error: status === 500 ? 'Internal server error' : message, requestId: req.requestId });
  });
  return app;
}
