import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogCache } from '../src/cache.mjs';

test('Redis startup rejects REST URLs and gives credential-free authentication diagnostics', async () => {
  const rest = new CatalogCache({ redisUrl: 'https://example.test', mode: 'production' }, () => { throw new Error('Must not create TCP client'); });
  await assert.rejects(rest.connect(), /HTTPS REST endpoint/);
  const secret = 'private-fixture-password';
  let options;
  const cache = new CatalogCache({ redisUrl: `rediss://default:${secret}@example.test:6379`, mode: 'production' }, value => {
    options = value;
    return { on() {}, isOpen: false, async connect() { throw new Error(`WRONGPASS ${secret}`); } };
  });
  await assert.rejects(cache.connect(), error => error.message.includes('authentication failed') && !error.message.includes(secret));
  assert.equal(options.socket.connectTimeout, 10000);
});
