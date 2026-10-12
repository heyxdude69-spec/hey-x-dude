import { spawn } from 'node:child_process';
import { readConfig } from '../src/config.mjs';
import { connectDatabase, setupDatabase } from '../src/models.mjs';
import { buildSitemaps } from '../src/sitemap.mjs';
import { setupInteractions } from '../src/interactions.mjs';
import { setupHome } from '../src/home.mjs';
const config = readConfig(), database = await connectDatabase(config);
try { await setupDatabase(database); await setupInteractions(database); await setupHome(database); await buildSitemaps(database, config); }
finally { await database.connection.close(); }
const child = spawn(process.execPath, ['src/server.mjs'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('exit', code => process.exit(code ?? 1));
