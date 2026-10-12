import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration } from '../src/lib/format-duration.ts';

test('durations support short clips and full movies', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(120), '2:00');
  assert.equal(formatDuration(3599), '59:59');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(7200), '2:00:00');
});
