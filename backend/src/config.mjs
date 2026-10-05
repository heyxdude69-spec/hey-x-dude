import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readSitePages } from './site-pages.mjs';

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}

export function readConfig(overrides = {}) {
  const mode = process.env.NODE_ENV || 'development';
  const site = new URL(process.env.SITE_URL || 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) throw new Error('Invalid SITE_URL');
  const providerHosts = JSON.parse(process.env.PROVIDER_HOSTS_JSON || '{"voe":["voe.sx"],"filemoon":[],"playmate":["playmate.to"],"vidara":["vidara.so","vidara.to"],"lulustream":["lulustream.com","lulust.com"],"direct":["interactive-examples.mdn.mozilla.net"],"reference":[]}');
  for (const hosts of Object.values(providerHosts)) {
    if (!Array.isArray(hosts) || hosts.some(host => typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host))) throw new Error('Invalid PROVIDER_HOSTS_JSON');
  }
  const config = {
    publicSiteOrigin: new URL(process.env.PUBLIC_SITE_URL || site.origin).origin,
    mode, host: process.env.HOST || '127.0.0.1', port: integer('PORT', 3000, 1, 65535),
    siteOrigin: site.origin, sitePages: readSitePages(), mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/video_catalog_mongo',
    mongoPoolSize: integer('MONGODB_POOL_SIZE', 40, 1, 200), queryTimeoutMs: integer('MONGODB_QUERY_TIMEOUT_MS', 3000, 100, 30000),
    redisUrl: process.env.REDIS_URL || '', cacheTtl: integer('CACHE_TTL_SECONDS', 90, 1, 600),
    localCacheTtl: integer('LOCAL_CACHE_TTL_SECONDS', 5, 1, 10), localCacheEntries: integer('LOCAL_CACHE_MAX_ENTRIES', 300, 1, 10000),
    publicCacheSeconds: integer('PUBLIC_CACHE_SECONDS', 15, 0, 60), rateLimit: integer('RATE_LIMIT_PER_MINUTE', 120, 10, 10000),
    maxConcurrent: integer('MAX_CONCURRENT_REQUESTS', 100, 1, 1000), trustProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 5),
    adminToken: process.env.ADMIN_API_TOKEN || '', interactionSecret: process.env.INTERACTION_PROXY_SECRET || '', providerHosts, ...overrides,
  };
  if (config.mode === 'production' && (!config.redisUrl || config.adminToken.length < 32 || site.protocol !== 'https:')) {
    throw new Error('Production requires REDIS_URL, HTTPS SITE_URL and a strong ADMIN_API_TOKEN');
  }
  config.cacheNamespace ||= `catalog:${createHash('sha256').update(`${config.siteOrigin}|${config.mongoUri}`).digest('hex').slice(0, 16)}`;
  return config;
}

export function approvedUrl(value, provider, config) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (config.providerHosts[provider] || []).includes(url.hostname.toLowerCase());
  } catch { return false; }
}
