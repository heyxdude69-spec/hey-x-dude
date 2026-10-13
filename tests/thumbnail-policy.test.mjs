import test from 'node:test';
import assert from 'node:assert/strict';
import { thumbnailHosts, optimizableThumbnail } from '../src/lib/thumbnail-policy.mjs';
test('thumbnail optimization uses exact HTTPS hosts and excludes wildcard/private/local inputs', () => {
  const hosts = thumbnailHosts('IMAGES.example.com,images.example.com,*.example.com,https://bad.test,127.0.0.1,foo.local,foo.internal');
  assert.deepEqual(hosts, ['images.example.com']);
  assert.equal(optimizableThumbnail('https://images.example.com/poster.jpg', hosts), true);
  for (const src of ['http://images.example.com/a.jpg', 'https://other.example.com/a.jpg', 'https://user:pass@images.example.com/a.jpg', 'https://images.example.com:8080/a.jpg', '//images.example.com/a.jpg', 'https://images.example.com/a.svg']) assert.equal(optimizableThumbnail(src, hosts), false);
  assert.equal(optimizableThumbnail('/watermark.png', []), true);
  assert.equal(optimizableThumbnail('/fallback.svg', []), false);
});
