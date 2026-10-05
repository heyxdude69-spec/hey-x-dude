import { readFileSync } from 'node:fs';
import { z } from 'zod';

const text = max => z.string().trim().min(1).max(max);
const url = z.url().refine(value => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'Site image/publisher URLs must use HTTPS');
const image = z.object({ url, alt: text(300).optional(), width: z.number().int().positive().max(20000).optional(), height: z.number().int().positive().max(20000).optional() }).strict();
export const sitePagesSchema = z.object({
  site: z.object({ name: text(150), language: text(30).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    logo: image.optional(), publisher: z.object({ name: text(150), url }).strict().optional(),
  }).strict(),
  categories: z.object({ h1: text(300), description: text(5000), bodyText: text(30000).optional(), thumbnail: image.optional(),
    seo: z.object({ title: text(300), metaDescription: text(1000), targetKeyword: text(200).optional(), indexAllowed: z.boolean() }).strict(),
  }).strict(),
}).strict();
export function readSitePages() {
  const bytes = readFileSync(new URL('../config/site-pages.json', import.meta.url));
  if (bytes.length > 65536) throw new Error('config/site-pages.json exceeds 64 KB');
  return sitePagesSchema.parse(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
}
