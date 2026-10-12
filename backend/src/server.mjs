import { readConfig } from './config.mjs';
import { connectDatabase } from './models.mjs';
import { CatalogCache } from './cache.mjs';
import { createApp } from './app.mjs';

const config = readConfig();
const database = await connectDatabase(config), cache = new CatalogCache(config);
try { await cache.connect(); } catch (error) { await database.connection.close(); throw error; }
const server = createApp({ database, cache, config }).listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: 'listening', host: config.host, port: config.port, cache: cache.mode }));
});
server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000; server.maxConnections = 2000;
async function stop() {
  const deadline = setTimeout(() => process.exit(1), 10000); deadline.unref();
  server.close(async () => { await Promise.allSettled([cache.close(), database.connection.close()]); clearTimeout(deadline); process.exit(0); });
  server.closeIdleConnections();
}
process.once('SIGTERM', stop); process.once('SIGINT', stop);
