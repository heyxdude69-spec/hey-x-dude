import { readConfig } from '../src/config.mjs';
import { connectDatabase } from '../src/models.mjs';
import { buildSitemaps } from '../src/sitemap.mjs';
const config = readConfig(), database = await connectDatabase(config);
try { console.log(JSON.stringify(await buildSitemaps(database, config))); }
finally { await database.connection.close(); }
