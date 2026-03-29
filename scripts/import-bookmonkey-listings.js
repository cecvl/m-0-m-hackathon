/* eslint-disable no-console */
require("dotenv").config({ path: ".env" });

const { MongoClient } = require("mongodb");
const axios = require("axios");

async function run() {
  const uri = process.env.DATABASE_URL || "";
  const dbName = process.env.MONGO_DB_NAME || "bookmarket";
  const baseUrl = (process.env.BOOKMONKEY_BASE_URL || "http://localhost:4730").replace(/\/$/, "");

  if (!uri) {
    throw new Error("DATABASE_URL is empty. Set it in backend/.env first.");
  }

  const response = await axios.get(`${baseUrl}/books`, { timeout: 10000 });
  const books = Array.isArray(response.data) ? response.data : [];
  if (books.length === 0) {
    throw new Error(`BookMonkey returned no books from ${baseUrl}/books`);
  }

  const listings = books.map((book, idx) => {
    const isbn = book.isbn || book.isbn13 || `bookmonkey-${idx}`;
    const authors = Array.isArray(book.authors) ? book.authors : [];
    const coverUrl = book.thumbnailUrl || book.cover || null;

    return {
      id: `bm-${isbn}`,
      title: book.title || "Untitled",
      author: authors[0] || book.author || "Unknown",
      isbn,
      condition: "Good",
      price: 350,
      description: book.subtitle || book.abstract || "Imported from BookMonkey API",
      sellerPhone: "bookmonkey-demo",
      available: true,
      source: "bookmonkey",
      coverUrl,
      createdAt: new Date().toISOString(),
      bookMonkeyData: {
        isbn,
        title: book.title || null,
        authors,
        categories: Array.isArray(book.categories) ? book.categories : [],
        coverUrl,
      },
    };
  });

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("listings");

  // Reset listing catalog source to BookMonkey for demo consistency.
  await collection.deleteMany({});

  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ available: 1, createdAt: -1 });
  await collection.createIndex({ source: 1, createdAt: -1 });
  await collection.createIndex({ isbn: 1 });

  let upserted = 0;
  for (const listing of listings) {
    const result = await collection.updateOne(
      { id: listing.id },
      { $set: listing },
      { upsert: true },
    );
    upserted += result.upsertedCount || 0;
  }

  const totalInCollection = await collection.countDocuments({});
  const totalBookMonkey = await collection.countDocuments({ source: "bookmonkey" });

  console.log(`Imported ${listings.length} BookMonkey listings into '${dbName}.listings'`);
  console.log(`Upserted: ${upserted}, Total in collection: ${totalInCollection}, Source=bookmonkey: ${totalBookMonkey}`);

  await client.close();
}

run().catch((error) => {
  console.error("BookMonkey listing import failed:", error.message || error);
  if (error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
