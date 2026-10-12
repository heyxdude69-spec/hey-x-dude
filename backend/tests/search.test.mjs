import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSearch, normalizeSearch } from '../src/search.mjs';
test('search normalizes punctuation without allowing text query operators', () => {
  assert.equal(normalizeSearch('  FOREST -walk "trail" '), 'forest walk trail');
  assert.equal(normalizeSearch('प्रकृति'), 'प्रकृति');
});
test('search isolates published ratings and filters unapproved sources with bounded queries', async () => {
  const calls = [];
  function model(name, rows) { return { find(filter) { calls.push([name, filter]); return {
    select() { return this; }, sort(value) { calls.push(['sort', value]); return this; },
    limit(value) { calls.push(['limit', value]); return this; }, maxTimeMS() { return this; }, lean: async () => rows,
  }; } }; }
  const database = {
    Video: model('Video', [{ _id: 'good', slug: 'forest', title: 'Forest', categories: ['nature'], language: 'en' }, { _id: 'bad', slug: 'bad', title: 'Bad' }]),
    VideoSource: model('VideoSource', [{ videoId: 'good', enabled: true, status: 'ready', availability: 'available', kind: 'embed', provider: 'voe', embedUrl: 'https://player.test/e/1' },
      { videoId: 'bad', enabled: true, status: 'ready', kind: 'embed', provider: 'voe', embedUrl: 'https://unapproved.test/e/2' }]),
    Category: model('Category', [{ slug: 'nature', name: 'Nature' }]),
  };
  const search = makeSearch(database, { getOrLoad: (_key, load) => load() }, { providerHosts: { voe: ['player.test'] }, queryTimeoutMs: 1000 });
  assert.deepEqual(await search('a', 'general'), { query: 'a', videos: [] });
  assert.equal(calls.length, 0);
  const result = await search('Forest', 'general');
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].category, 'Nature');
  assert.deepEqual(calls[0], ['Video', { status: 'published', contentRating: 'general', $text: { $search: 'forest', $language: 'none' } }]);
  assert.ok(calls.some(call => call[0] === 'limit' && call[1] === 28));
  calls.length = 0;
  await search('', 'adult');
  assert.deepEqual(calls[0], ['Video', { status: 'published', contentRating: 'adult' }]);
});
