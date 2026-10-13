import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHome, homeSettingsInput, homeFilter, homeSort } from '../src/home.mjs';
const section = overrides => ({ key: 'latest', title: 'Custom latest title', type: 'latest', limit: 2, collectionPageSize: 3, windowSize: 6,
  order: 1, enabled: true, paginate: false, badgeText: 'New', seeMoreLabel: 'Browse', ...overrides });
const settings = sections => ({ key: 'homepage', contentRating: 'general', seo: { title: 'Custom home title', metaDescription: 'Custom description', indexAllowed: true },
  fallbackCategoryLabel: 'Videos', emptyMessage: 'Empty collection', sections });
test('settings validate category/quality requirements, bounded limits and unique keys', () => {
  assert.throws(() => homeSettingsInput.parse(settings([section({ type: 'category' })])));
  assert.throws(() => homeSettingsInput.parse(settings([section({ type: 'quality' })])));
  assert.throws(() => homeSettingsInput.parse(settings([section({ windowSize: 501 })])));
  assert.throws(() => homeSettingsInput.parse(settings([section({}), section({})])));
  assert.equal(homeSettingsInput.parse(settings([section({})])).sections[0].title, 'Custom latest title');
  assert.deepEqual(homeFilter(section({ type: 'category', categorySlug: 'nature' }), 'adult'), { status: 'published', contentRating: 'adult', categories: 'nature' });
  assert.deepEqual(homeSort(section({ type: 'popular' })), { 'metrics.views': -1, publishedAt: -1, _id: -1 });
});
test('home obeys DB section order/labels, excludes unplayable sources, clamps paging and resolves category labels', async () => {
  const queries = [];
  const candidates = Array.from({ length: 6 }, (_, i) => ({ _id: `id${i}`, slug: `walk-${i}`, title: `Walk ${i}`, tags: [], categories: ['nature'],
    thumbnail: { url: 'https://images.test/poster.jpg' }, metrics: {}, publishedAt: new Date() }));
  function q(value) { return { select() { return this; }, sort(sort) { queries.push({ sort }); return this; }, limit(limit) { queries.push({ limit }); return this; },
    lean() { return this; }, maxTimeMS: async () => value }; }
  const Settings = { findOne: () => q(settings([section({ key: 'hd', title: 'Custom quality', type: 'quality', qualities: ['hd'], paginate: true, order: 2 }),
    section({}), section({ key: 'off', enabled: false })])) };
  const database = { Video: { find(filter) { queries.push(filter); return q(candidates); } },
    VideoSource: { aggregate(stages) { const match = stages[0].$match;
      assert.equal(match.enabled, true); assert.equal(match.status, 'ready'); assert.equal(match.availability.$ne, 'unavailable');
      assert.ok(match.$or[0].embedUrl.test('https://voe.sx/e/a')); assert.ok(!match.$or[0].embedUrl.test('https://voe.sx.evil/e/a'));
      return { option: async () => candidates.filter(row => row._id !== 'id0').map(row => ({ _id: row._id })) }; } },
    Category: { find: () => q([{ slug: 'nature', name: 'Nature' }]), exists: () => q(true) } };
  const api = makeHome(database, { getOrLoad: (_key, run) => run() }, { providerHosts: { voe: ['voe.sx'] }, queryTimeoutMs: 1000 }, Settings);
  const result = await api.get({ page: 500 });
  assert.deepEqual(result.sections.map(row => row.key), ['latest', 'hd']);
  assert.equal(result.sections[0].videos[0].slug, 'walk-1');
  assert.equal(result.sections[0].videos[0].categoryName, 'Nature');
  assert.equal(result.sections[0].title, 'Custom latest title');
  assert.equal(result.sections[0].pagination.currentPage, 1);
  assert.equal(result.sections[1].pagination.currentPage, 1);
  assert.equal(result.sections[1].videos.length, 5);
  assert.equal(result.sections[1].limit, 8);
  assert.equal(result.sections[1].paginate, false);
  assert.equal(result.sections[1].seeMoreUrl, '/collections/hd');
  const collection = await api.get({ section: 'latest' });
  assert.equal(collection.sections[0].videos.length, 3);
  assert.equal(collection.sections[0].pagination.pageCount, 2);
  assert.ok(queries.some(filter => filter['media.quality']?.$in?.includes('hd')));
  await assert.rejects(api.get({ section: 'off' }), /not found/);
});


test('quality collection pages are not restricted to the homepage candidate window', async () => {
  const quality = section({ key: 'hd', type: 'quality', qualities: ['hd'], windowSize: 6, collectionPageSize: 3 });
  const q = value => ({ select() { return this; }, lean() { return this; }, maxTimeMS: async () => value });
  let stages;
  const database = { Video: { aggregate(value) { stages = value; return { option: async () => [{ total: [{ count: 501 }], rows: [] }] }; } }, VideoSource: {}, Category: {} };
  const api = makeHome(database, { getOrLoad: (_key, run) => run() }, { providerHosts: { voe: ['player.test'] }, queryTimeoutMs: 1000 }, { findOne: () => q(settings([quality])) });
  const data = await api.get({ section: 'hd', page: 2 });
  assert.equal(data.sections[0].pagination.pageCount, 167);
  assert.equal(data.sections[0].pagination.currentPage, 2);
  assert.equal(stages.at(-1).$facet.rows[0].$skip, 3);
  assert.equal(stages.at(-1).$facet.rows[1].$limit, 3);
  assert.equal(stages.some(stage => '$limit' in stage), false);
  await assert.rejects(api.get({ section: 'hd', page: 168 }), /not found/);
});
