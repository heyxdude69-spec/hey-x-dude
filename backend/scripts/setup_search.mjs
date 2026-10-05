import { readConfig } from '../src/config.mjs';
import { connectDatabase } from '../src/models.mjs';
import { SEARCH_INDEX_KEYS, SEARCH_INDEX_OPTIONS } from '../src/search.mjs';
const database = await connectDatabase(readConfig());
try {
  await database.Video.collection.createIndex(SEARCH_INDEX_KEYS, SEARCH_INDEX_OPTIONS);
  console.log('Catalog search index ready.');
} finally { await database.connection.close(); }
