import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNavigation } from '../src/lib/navigation-api.ts';

test('navigation preserves database names and slugs and rejects unsafe or duplicate links', () => {
  const categories = [{ slug: 'forest-walk', name: 'Forest Walk' }, { slug: 'nature', name: 'Nature' }];
  assert.deepEqual(parseNavigation({ categories }), categories);
  assert.deepEqual(parseNavigation({ categories: [] }), []);
  assert.throws(() => parseNavigation({ categories: [{ slug: '../admin', name: 'Bad' }] }));
  assert.throws(() => parseNavigation({ categories: [categories[0], categories[0]] }));
});
