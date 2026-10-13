import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationBadges } from '../src/lib/recommendation-badges.ts';
test('badges select two initial cards and one expanded card without changing order', () => {
  const ids = Array.from({ length: 16 }, (_, index) => `sample-${index}`), original = [...ids];
  const badges = recommendationBadges(ids, '0123456789abcdef');
  assert.equal(ids.slice(0, 8).filter(id => badges.has(id)).length, 2);
  assert.equal(ids.slice(8).filter(id => badges.has(id)).length, 1);
  assert.deepEqual([...recommendationBadges(ids, '0123456789abcdef')], [...badges]);
  assert.deepEqual(ids, original);
  assert.notDeepEqual([...recommendationBadges(ids, 'fedcba9876543210')], [...badges]);
});
test('short and empty batches never invent cards or duplicate picks', () => {
  assert.equal(recommendationBadges([], 'seed').size, 0);
  assert.deepEqual([...recommendationBadges(['one', 'one'], 'seed')], ['one']);
  assert.equal(recommendationBadges(['one', 'two', 'three'], 'seed').size, 2);
});
