import { mkdir, writeFile } from 'node:fs/promises';
import { readConfig } from '../src/config.mjs';
import { connectDatabase, setupDatabase } from '../src/models.mjs';
import { setupInteractions } from '../src/interactions.mjs';
import { setupHome } from '../src/home.mjs';

const config = readConfig(), database = await connectDatabase(config);
try {
  await setupDatabase(database);
  await setupInteractions(database);
  await setupHome(database);
  const receipt = { createdAt: new Date().toISOString(), database: database.connection.name,
    collections: await Promise.all([database.Video, database.VideoSource, database.Category].map(async model => ({
      name: model.collection.name, documents: await model.countDocuments(), indexes: (await model.collection.indexes()).map(index => ({ name: index.name, key: index.key, unique: index.name === '_id_' || !!index.unique })),
    }))) };
  await mkdir('.runtime', { recursive: true });
  await writeFile('.runtime/database-setup.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally { await database.connection.close(); }
