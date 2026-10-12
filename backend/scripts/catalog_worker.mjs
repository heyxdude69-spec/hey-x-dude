import { readConfig } from '../src/config.mjs';
import { connectDatabase } from '../src/models.mjs';
import { buildSitemaps } from '../src/sitemap.mjs';
const config = readConfig(), database = await connectDatabase(config);
let stopped = false;
process.once('SIGTERM', () => { stopped = true; }); process.once('SIGINT', () => { stopped = true; });
try {
  while (!stopped) {
    try { console.log(JSON.stringify({ event: 'sitemap-built', ...await buildSitemaps(database, config) })); }
    catch (error) { console.error(JSON.stringify({ event: 'sitemap-failed', errorType: error.name })); }
    // Wake frequently for a prompt shutdown; a build runs every five minutes.
    for (let tick = 0; tick < 30 && !stopped; tick++) await new Promise(resolve => setTimeout(resolve, 10000));
  }
} finally { await database.connection.close(); }
