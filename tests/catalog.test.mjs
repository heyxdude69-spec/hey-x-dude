import assert from 'node:assert/strict';
import { test } from 'node:test';
import { films } from '../src/data/catalog.ts';
import { existsSync } from 'node:fs';
import { formatDuration } from '../src/lib/format-duration.ts';

test('video slugs are unique and URL safe', () => {
  assert.equal(films[0].slug, 'beyond-the-horizon');
  assert.equal(new Set(films.map(film => film.slug)).size, films.length);
  for (const film of films) {
    assert.match(film.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(film.description.includes(film.title));
    assert.ok(film.tags.includes(film.genre));
    assert.ok(film.duration > 0);
    assert.ok(film.categories.includes(film.category));
    assert.ok(film.movie && film.language);
    assert.ok(['SD', 'HD', '4K'].includes(film.quality));
    assert.ok(existsSync(new URL(`../public${film.thumbnail}`, import.meta.url)));
    assert.ok(!Number.isNaN(Date.parse(film.uploadedAt)));
    assert.deepEqual(film.servers.map(server => server.provider), ['VOE', 'Vidara', 'Lulustream', 'Stream']);
    for (const server of film.servers) assert.ok(existsSync(new URL(`../public${server.embedUrl.split('?')[0]}`, import.meta.url)));
    if (film.downloadEnabled) assert.ok(film.downloadUrl && existsSync(new URL(`../public${film.downloadUrl}`, import.meta.url)));
  }
});

test('durations support short clips and full movies', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(120), '2:00');
  assert.equal(formatDuration(3599), '59:59');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(7200), '2:00:00');
});
