import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

export function redisFailureHint(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  if (/wrongpass|noauth|authentication|invalid username.password/.test(message)) return 'authentication failed; use the TCP read/write username and password';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'DNS lookup failed; check the Redis endpoint';
  if (code === 'ECONNREFUSED') return 'connection refused; check endpoint and port';
  if (code === 'ETIMEDOUT' || /timeout|timed out/.test(message)) return 'connection timed out; check network access, TLS and port';
  if (/tls|ssl|certificate/.test(message) || ['ERR_SSL_WRONG_VERSION_NUMBER', 'CERT_HAS_EXPIRED'].includes(code)) return 'TLS connection failed; copy the Upstash rediss:// TCP URL';
  return 'connection failed; verify the complete TCP URL, password, TLS and database availability';
}

export class CatalogCache {
  constructor(config, clientFactory = createClient) {
    this.clientFactory = clientFactory;
    this.config = config; this.entries = new Map(); this.bytes = 0; this.flights = new Map();
    this.prefix = config.cacheNamespace || 'catalog';
    this.localEpoch = 1; this.stats = { hits: 0, misses: 0, loads: 0, invalidations: 0 };
  }
  async connect() {
    if (!this.config.redisUrl) return;
    let parsed;
    try { parsed = new URL(this.config.redisUrl); } catch { throw new Error('Invalid REDIS_URL; copy the full Redis TCP connection URL'); }
    if (!['redis:', 'rediss:'].includes(parsed.protocol)) throw new Error('REDIS_URL must be redis:// or rediss://; an HTTPS REST endpoint is not supported');
    let lastError;
    this.redis = this.clientFactory({ url: this.config.redisUrl, disableOfflineQueue: true,
      socket: { connectTimeout: 10000, reconnectStrategy: retries => retries < 3 ? Math.min(200 * (retries + 1), 1000) : false } });
    this.redis.on('error', error => { lastError = error; });
    try { await this.redis.connect(); }
    catch (error) {
      if (this.redis.isOpen) this.redis.destroy();
      if (this.config.mode === 'production') throw new Error(`Redis unavailable; production startup cancelled: ${redisFailureHint(lastError || error)}`);
      console.warn('Redis unavailable; using bounded local cache.');
    }
  }
  get mode() { return this.redis?.isReady ? 'redis+l1' : 'local'; }
  async epoch() {
    if (this.redis?.isReady) {
      try {
        let value = await this.redis.get(`${this.prefix}:epoch`);
        if (!value) {
          const proposed = randomUUID();
          await this.redis.set(`${this.prefix}:epoch`, proposed, { NX: true });
          value = await this.redis.get(`${this.prefix}:epoch`) || proposed;
        }
        // UUID namespaces prevent old entries being reused after cache-key eviction/restarts.
        return `r:${value}`;
      } catch {}
    }
    return `l:${this.localEpoch}`;
  }
  remember(key, value) {
    const json = JSON.stringify(value), bytes = Buffer.byteLength(json);
    if (bytes > 200000) return;
    const old = this.entries.get(key); if (old) this.bytes -= old.bytes;
    this.entries.delete(key);
    this.entries.set(key, { json, bytes, expires: Date.now() + this.config.localCacheTtl * 1000 });
    this.bytes += bytes;
    while (this.entries.size > this.config.localCacheEntries || this.bytes > 8 * 1024 * 1024) {
      const oldest = this.entries.keys().next().value;
      this.bytes -= this.entries.get(oldest).bytes; this.entries.delete(oldest);
    }
  }
  async getOrLoad(name, loader, ttl = this.config.cacheTtl) {
    const key = `${this.prefix}:${await this.epoch()}:${name}`;
    const local = this.entries.get(key);
    if (local && local.expires > Date.now()) { this.stats.hits++; return JSON.parse(local.json); }
    if (local) { this.entries.delete(key); this.bytes -= local.bytes; }
    if (this.flights.has(key)) return structuredClone(await this.flights.get(key));
    const flight = this.load(key, loader, ttl);
    this.flights.set(key, flight);
    try { return structuredClone(await flight); } finally { this.flights.delete(key); }
  }
  async load(key, loader, ttl) {
    if (this.redis?.isReady) {
      try {
        const raw = await this.redis.get(key);
        if (raw) { const data = JSON.parse(raw); this.remember(key, data); this.stats.hits++; return data; }
      } catch {}
    }
    this.stats.misses++;
    const lockKey = `${key}:lock`, token = randomUUID(); let ownsLock = false;
    if (this.redis?.isReady) {
      try {
        ownsLock = await this.redis.set(lockKey, token, { NX: true, PX: 5000 }) === 'OK';
        if (!ownsLock) {
          for (let attempt = 0; attempt < 8; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 75));
            const raw = await this.redis.get(key);
            if (raw) { const data = JSON.parse(raw); this.remember(key, data); this.stats.hits++; return data; }
          }
        }
      } catch {}
    }
    try {
      this.stats.loads++;
      const data = await loader();
      // Null/error results are not retained; a newly published page is discoverable immediately.
      if (data != null) {
        this.remember(key, data);
        if (this.redis?.isReady) {
          const expiry = Math.max(1, Math.round(ttl * (0.9 + Math.random() * 0.2)));
          try { await this.redis.set(key, JSON.stringify(data), { EX: expiry }); } catch {}
        }
      }
      return data;
    } finally {
      if (ownsLock && this.redis?.isReady) {
        try { await this.redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", { keys: [lockKey], arguments: [token] }); } catch {}
      }
    }
  }
  async invalidate() {
    this.localEpoch++; this.entries.clear(); this.bytes = 0; this.stats.invalidations++;
    if (this.redis?.isReady) {
      try {
        await this.redis.set(`${this.prefix}:epoch`, randomUUID());
      } catch {}
    }
  }
  async close() { if (this.redis?.isOpen) await this.redis.quit().catch(() => this.redis.destroy()); }
}

export class RequestLimiter {
  constructor(cache, config) { this.cache = cache; this.config = config; this.windows = new Map(); }
  async allow(ip, admin = false) {
    const limit = admin ? Math.min(30, this.config.rateLimit) : this.config.rateLimit;
    const window = Math.floor(Date.now() / 60000), key = `${this.cache.prefix}:rate:${admin ? 'admin' : 'public'}:${ip}:${window}`;
    if (this.cache.redis?.isReady) {
      try {
        const count = await this.cache.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],61) end; return n", { keys: [key], arguments: [] });
        return Number(count) <= limit;
      } catch {}
    }
    const item = this.windows.get(key) || { count: 0, expires: (window + 1) * 60000 };
    item.count++; this.windows.set(key, item);
    if (this.windows.size > 10000) {
      for (const [name, value] of this.windows) if (value.expires < Date.now()) this.windows.delete(name);
      while (this.windows.size > 10000) this.windows.delete(this.windows.keys().next().value);
    }
    return item.count <= limit;
  }
}
