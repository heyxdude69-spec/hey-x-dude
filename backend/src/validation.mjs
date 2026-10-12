import { z } from 'zod';
import { httpsUrl, PROVIDERS, SLUG_PATTERN } from './models.mjs';

const text = max => z.string().trim().max(max);
const url = z.string().max(2048).refine(httpsUrl, 'A credential-free HTTPS URL is required');
const date = z.iso.datetime({ offset: true }).transform(value => new Date(value));
const tags = z.array(text(80).min(1)).max(32);
export const videoCreate = z.object({
  slug: text(180).regex(SLUG_PATTERN), title: text(300).min(1), h1: text(300).optional(),
  description: text(5000).optional(), bodyText: text(30000).optional(),
  language: text(30).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
  seo: z.object({ title: text(300).optional(), metaDescription: text(1000).optional(), targetKeyword: text(200).optional(), indexAllowed: z.boolean().optional() }).strict().optional(),
  thumbnail: z.object({ url: url.optional(), alt: text(300).optional(), width: z.number().int().min(1).max(20000).optional(), height: z.number().int().min(1).max(20000).optional() }).strict().optional(),
  tags: tags.optional(), categories: z.array(text(80).regex(SLUG_PATTERN)).max(12).optional(),
  durationSeconds: z.number().int().min(1).max(86400).optional(), uploadDate: date.optional(), publishedAt: date.optional(),
  media: z.object({ width: z.number().int().min(1).max(32768).optional(), height: z.number().int().min(1).max(32768).optional(),
    fps: z.number().min(0).max(1000).optional(), videoCodec: text(80).optional(), audioCodec: text(80).optional(),
    fileSizeBytes: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(), sha256: text(64).regex(/^[a-f0-9]{64}$/).optional(),
    quality: z.enum(['sd', 'hd', 'fullhd', 'uhd']).optional() }).strict().optional(),
  metrics: z.object({ views: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), likes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    dislikes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), ratingAverage: z.number().min(0).max(5).optional(),
    ratingCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), origin: z.enum(['seed', 'site']).optional() }).strict().optional(),
  transcript: text(100000).optional(), author: text(150).optional(),
  contentRating: z.enum(['unknown', 'general', 'adult']).optional(), status: z.enum(['draft', 'published', 'archived']).optional(),
}).strict();
export const videoUpdate = videoCreate.omit({ slug: true }).partial();
export const categoryCreate = z.object({
  slug: text(80).regex(SLUG_PATTERN), name: text(150).min(1), description: text(5000).optional(),
  h1: text(300).optional(), bodyText: text(30000).optional(), language: videoCreate.shape.language,
  seo: videoCreate.shape.seo, thumbnail: videoCreate.shape.thumbnail,
  contentRating: z.enum(['general', 'adult']).optional(), status: z.enum(['draft', 'active', 'archived']).optional(),
}).strict();
export const categoryUpdate = categoryCreate.omit({ slug: true, contentRating: true }).partial();
export const sourceCreate = z.object({
  provider: z.enum(PROVIDERS), externalVideoId: text(300).min(1), kind: z.enum(['embed', 'direct']),
  embedUrl: url.optional(), contentUrl: url.optional(), priority: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(), status: z.enum(['pending', 'processing', 'ready', 'failed', 'removed']).optional(),
  availability: z.enum(['unknown', 'available', 'unavailable']).optional(),
  lastCheckedAt: date.optional(), lastError: text(500).optional(),
}).strict();
export const sourceUpdate = sourceCreate.omit({ provider: true, externalVideoId: true }).partial();
export function requireId(value) { return /^[a-f0-9]{24}$/.test(value || ''); }
