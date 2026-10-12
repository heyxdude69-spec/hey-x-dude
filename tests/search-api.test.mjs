import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSuggestions } from '../src/lib/search-api.ts';
test('suggestions validate slugs, bound results and reject unsafe images', () => {
  const row = { id: '1', slug: 'forest', title: 'Forest', thumbnail: { url: 'javascript:bad' }, category: 'Nature', language: 'en' };
  const [suggestion] = parseSuggestions({ videos: [row] });
  assert.equal(suggestion.thumbnail, '/thumbnails/scene-1.svg');
  assert.equal(suggestion.category, 'Nature');
  assert.throws(() => parseSuggestions({ videos: [{ ...row, slug: '../admin' }] }));
  assert.throws(() => parseSuggestions({ videos: Array(8).fill(row) }));
});
