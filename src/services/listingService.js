const { randomUUID } = require("crypto");
const { db, nowIso, createPhoneUser } = require("../data/store");
const {
  saveListing,
  findAvailableListings,
} = require("../data/listingRepository");

async function createListing(payload) {
  createPhoneUser(payload.sellerPhone);

  const listing = {
    id: randomUUID(),
    title: payload.title,
    author: payload.author,
    isbn: payload.isbn || null,
    condition: payload.condition,
    price: payload.price,
    description: payload.description,
    sellerPhone: payload.sellerPhone,
    available: true,
    createdAt: nowIso(),
  };

  db.books.set(listing.id, listing);

  try {
    await saveListing(listing);
  } catch (error) {
    console.warn("MongoDB listing save failed, continuing in-memory:", error.message);
  }

  return listing;
}

async function listBooks(query = "") {
  try {
    const mongoListings = await findAvailableListings(query);
    if (Array.isArray(mongoListings)) {
      for (const listing of mongoListings) {
        db.books.set(listing.id, listing);
      }
      return mongoListings;
    }
  } catch (error) {
    console.warn("MongoDB listing search failed, using in-memory search:", error.message);
  }

  const q = query.trim().toLowerCase();
  const books = Array.from(db.books.values()).filter((book) => book.available);

  if (!q) {
    return books;
  }

  return books.filter((book) => {
    return [book.title, book.author, book.isbn, book.description]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });
}

module.exports = {
  createListing,
  listBooks,
};
