const axios = require("axios");
const { env } = require("../config/env");

function getBaseUrl() {
  return (env.bookMonkeyBaseUrl || "http://localhost:4730").replace(/\/$/, "");
}

function mapBookMonkeyBook(book = {}) {
  const isbn = book.isbn || book.isbn13 || null;
  const authors = Array.isArray(book.authors) ? book.authors : [];
  const coverUrl = book.thumbnailUrl || book.cover || null;

  return {
    id: `bm-${isbn || book._id || Math.random().toString(36).slice(2, 10)}`,
    title: book.title || "Untitled",
    author: authors[0] || book.author || "Unknown",
    isbn,
    condition: "Good",
    price: 350,
    description: book.subtitle || book.abstract || "Imported from BookMonkey API",
    sellerPhone: "bookmonkey-demo",
    available: true,
    createdAt: new Date().toISOString(),
    source: "bookmonkey",
    coverUrl,
    bookMonkeyData: {
      isbn,
      title: book.title || null,
      authors,
      categories: Array.isArray(book.categories) ? book.categories : [],
      coverUrl,
    },
  };
}

async function fetchBookMonkeyBooks(query = "", limit = 24) {
  const response = await axios.get(`${getBaseUrl()}/books`, { timeout: 6000 });
  const books = Array.isArray(response.data) ? response.data : [];

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? books
    : books.filter((book) => {
        const title = String(book.title || "").toLowerCase();
        const isbn = String(book.isbn || "").toLowerCase();
        const authors = Array.isArray(book.authors)
          ? book.authors.join(" ").toLowerCase()
          : String(book.author || "").toLowerCase();
        return title.includes(q) || isbn.includes(q) || authors.includes(q);
      });

  return filtered.slice(0, limit).map(mapBookMonkeyBook);
}

async function checkBookMonkeyHealth() {
  const response = await axios.get(`${getBaseUrl()}/books`, { timeout: 4000 });
  const books = Array.isArray(response.data) ? response.data : [];
  return {
    ok: true,
    baseUrl: getBaseUrl(),
    count: books.length,
  };
}

module.exports = {
  fetchBookMonkeyBooks,
  checkBookMonkeyHealth,
};
