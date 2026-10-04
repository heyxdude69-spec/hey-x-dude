import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPageNumbers } from '../src/lib/pagination.ts';

test('pagination keeps at most six consecutive buttons including the current page', () => {
  for (const count of [1, 4, 6, 7, 20]) {
    for (let current = 1; current <= count; current++) {
      const pages = getPageNumbers(current, count);
      assert.equal(pages.length, Math.min(6, count));
      assert.ok(pages.includes(current));
      assert.ok(pages[0] >= 1 && pages.at(-1) <= count);
      assert.ok(pages.every((page, index) => index === 0 || page === pages[index - 1] + 1));
    }
  }
});
