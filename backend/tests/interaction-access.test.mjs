import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.mjs';
import { readConfig } from '../src/config.mjs';
test('interaction endpoints reject direct unauthenticated callers and invalid visitor IDs before touching MongoDB', async () => {
  const config = readConfig({ mode: 'test', interactionSecret: 's'.repeat(64), rateLimit: 120, maxConcurrent: 10 });
  const app = createApp({ database: { connection: { readyState: 1 } }, cache: { prefix: 'test' }, config, logRequests: false });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/videos/forest/interactions`;
    const denied = await fetch(url);
    assert.equal(denied.status, 401); assert.equal(denied.headers.get('cache-control'), 'no-store');
    const badVisitor = await fetch(url, { headers: { 'X-Interaction-Secret': 's'.repeat(64), 'X-Visitor-Id': 'invalid' } });
    assert.equal(badVisitor.status, 400);
    const deniedComments = await fetch(url.replace('/interactions', '/comments'), { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test', text: 'hello' }) });
    assert.equal(deniedComments.status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
