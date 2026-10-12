import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../src/config.mjs';
import { CatalogCache } from '../src/cache.mjs';

test('live Redis: two instances share misses, invalidate L1 and cannot reuse evicted namespaces', async t => {
  const config = readConfig({ mode: 'test', cacheNamespace: `catalog:test:${randomUUID()}`, cacheTtl: 2 });
  if (!config.redisUrl) { t.skip('Set REDIS_URL to run shared-cache integration'); return; }
  const first = new CatalogCache(config), second = new CatalogCache(config);
  try {
    await first.connect(); await second.connect();
    assert.equal(first.mode, 'redis+l1'); assert.equal(second.mode, 'redis+l1');
    let calls = 0;
    const loader = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 120)); return { generation: calls }; };
    const results = await Promise.all([first.getOrLoad('page', loader), second.getOrLoad('page', loader)]);
    assert.equal(calls, 1); assert.equal(results[0].generation, results[1].generation);
    await first.invalidate();
    assert.equal((await second.getOrLoad('page', loader)).generation, 2);
    // Evict only this test's namespace marker, not any application cache data.
    await first.redis.del(`${config.cacheNamespace}:epoch`);
    assert.equal((await second.getOrLoad('page', loader)).generation, 3);
  } finally {
    if (first.redis?.isReady) await first.redis.del(`${config.cacheNamespace}:epoch`);
    await Promise.all([first.close(), second.close()]);
  }
});
