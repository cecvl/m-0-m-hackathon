/* eslint-disable no-console */
require("dotenv").config({ path: ".env" });

const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

async function run() {
  const uri = process.env.DATABASE_URL || "";
  const dbName = process.env.MONGO_DB_NAME || "bookmarket";

  if (!uri) {
    throw new Error("DATABASE_URL is empty. Set it in backend/.env first.");
  }

  const dataPath = path.resolve(__dirname, "../data/dummy-listings.json");
  const fileContents = await fs.readFile(dataPath, "utf8");
  const parsed = JSON.parse(fileContents);

  if (!parsed || !Array.isArray(parsed.data)) {
    throw new Error("Invalid JSON format: expected an object with a 'data' array.");
  }

  const listings = parsed.data;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("listings");

  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ available: 1, createdAt: -1 });
  try {
    await collection.createIndex({ title: "text", author: "text", isbn: "text", description: "text" });
  } catch (error) {
    // Atlas can already have a text index with different options; importing data should still continue.
    if (!String(error.message || "").includes("equivalent index already exists")) {
      throw error;
    }
  }

  let upserted = 0;
  let modified = 0;

  for (const listing of listings) {
    const result = await collection.updateOne(
      { id: listing.id },
      { $set: listing },
      { upsert: true },
    );

    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  const totalInCollection = await collection.countDocuments();
  console.log(`Imported ${listings.length} listings into '${dbName}.listings'`);
  console.log(`Upserted: ${upserted}, Updated existing: ${modified}, Total now: ${totalInCollection}`);

  await client.close();
}

run().catch((error) => {
  console.error("Listing import failed:", error.message);
  process.exit(1);
});
