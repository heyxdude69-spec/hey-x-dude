import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTagPage, validTagSlug } from '../src/lib/tag-api.ts';

test('tag response validates identity and content rating and maps real metrics', () => {
  const data = { tag: { slug: 'forest-walk', name: 'forest walk', contentRating: 'general' },
    videos: [{ id: '1', slug: 'forest', title: 'Forest', metrics: { views: 42, likes: 3, dislikes: 1 }, quality: 'hd' }],
    pagination: { currentPage: 1, pageCount: 1, totalVideos: 1 } };
  const page = parseTagPage(data, 'forest-walk', 'general');
  assert.equal(page.films[0].rating, 75);
  assert.equal(page.films[0].quality, 'HD');
  assert.throws(() => parseTagPage(data, 'travel', 'general'));
  assert.throws(() => parseTagPage(data, 'forest-walk', 'adult'));
  assert.equal(validTagSlug('café'), true);
  assert.equal(validTagSlug('../admin'), false);
  assert.equal(validTagSlug('Forest'), false);
});
