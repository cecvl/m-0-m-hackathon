const { MongoClient } = require("mongodb");
const { env } = require("../config/env");

let mongoClientPromise = null;
let mongoDbPromise = null;
let listingsIndexesReady = false;

async function getMongoDb() {
  if (!env.databaseUrl) {
    return null;
  }

  if (!mongoDbPromise) {
    const client = new MongoClient(env.databaseUrl, {
      serverSelectionTimeoutMS: 5000,
    });
    mongoClientPromise = client.connect();
    mongoDbPromise = mongoClientPromise.then((connectedClient) => connectedClient.db(env.mongoDbName));
  }

  try {
    return await mongoDbPromise;
  } catch (error) {
    console.warn("MongoDB unavailable, using in-memory fallback:", error.message);
    mongoDbPromise = null;
    if (mongoClientPromise) {
      try {
        const client = await mongoClientPromise;
        await client.close();
      } catch {
        // Ignore close failures.
      }
      mongoClientPromise = null;
    }
    return null;
  }
}

async function getListingsCollection() {
  const db = await getMongoDb();
  if (!db) {
    return null;
  }

  const collection = db.collection("listings");
  if (!listingsIndexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ available: 1, createdAt: -1 });
    await collection.createIndex({ source: 1, createdAt: -1 });
    await collection.createIndex({ isbn: 1 });
    await collection.createIndex({ "bookMonkeyData.isbn": 1 });
    try {
      await collection.createIndex({ title: "text", author: "text", isbn: "text", description: "text" });
    } catch (error) {
      if (!String(error.message || "").includes("equivalent index already exists")) {
        throw error;
      }
    }
    listingsIndexesReady = true;
  }

  return collection;
}

module.exports = {
  getMongoDb,
  getListingsCollection,
};
