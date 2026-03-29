require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

const uri = process.env.DATABASE_URL || '';
const dbName = process.env.MONGO_DB_NAME || '';

(async () => {
  if (!uri) {
    throw new Error('DATABASE_URL is empty');
  }
  if (uri.includes('<db_password>')) {
    throw new Error('DATABASE_URL still contains <db_password> placeholder');
  }
  if (!dbName) {
    throw new Error('MONGO_DB_NAME is empty');
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const ping = await client.db(dbName).command({ ping: 1 });
  console.log(`MongoDB ping ok for db '${dbName}':`, JSON.stringify(ping));
  await client.close();
})().catch((error) => {
  console.error('MongoDB ping failed:', error.message);
  process.exit(1);
});
