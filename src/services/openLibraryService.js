const axios = require("axios");

// In-memory cache to avoid redundant API calls
// Map: ISBN -> { data, cachedAt (timestamp) }
const enrichmentCache = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const OL_API_BASE = "https://openlibrary.org/api";

/**
 * Fetches book metadata from Open Library API
 * Designed to enrich seller-provided listing data with standardized info
 * Includes caching, rate-limit awareness, and graceful fallback
 */
async function enrichBookData(isbn) {
  // Validate ISBN format (basic check)
  if (!isbn || typeof isbn !== "string") {
    return null;
  }

  const normalizedISBN = isbn.replace(/[^0-9X]/g, ""); // Remove hyphens, spaces

  // Check cache first
  if (enrichmentCache.has(normalizedISBN)) {
    const cached = enrichmentCache.get(normalizedISBN);
    if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`[OpenLibrary] Cache HIT for ISBN: ${normalizedISBN}`);
      return cached.data;
    } else {
      // Cache expired, remove it
      enrichmentCache.delete(normalizedISBN);
    }
  }

  try {
    console.log(`[OpenLibrary] Fetching metadata for ISBN: ${normalizedISBN}`);

    // Open Library ISBN API endpoint
    const response = await axios.get(`${OL_API_BASE}/books?isbn=${normalizedISBN}&format=json`, {
      timeout: 5000, // 5 second timeout to avoid hanging
    });

    if (!response.data || Object.keys(response.data).length === 0) {
      console.log(`[OpenLibrary] No data found for ISBN: ${normalizedISBN}`);
      enrichmentCache.set(normalizedISBN, { data: null, cachedAt: Date.now() });
      return null;
    }

    // Extract first result from the ISBN API response
    const bookKey = Object.keys(response.data)[0];
    const bookData = response.data[bookKey];

    // Normalize the response into a standard format
    const enrichedData = {
      isbn: normalizedISBN,
      title: bookData.title || null,
      authors: bookData.authors?.map((a) => (typeof a === "string" ? a : a.name)) || [],
      publishDate: bookData.publish_date || bookData.first_publish_date || null,
      publishers: bookData.publishers?.map((p) => (typeof p === "string" ? p : p.name)) || [],
      coverUrl: bookData.cover?.medium || bookData.cover?.small || null,
      pages: bookData.number_of_pages || null,
      language: bookData.languages?.[0] || "en",
      categories: bookData.subjects || [],
    };

    // Cache the enriched data
    enrichmentCache.set(normalizedISBN, {
      data: enrichedData,
      cachedAt: Date.now(),
    });

    console.log(`[OpenLibrary] Successfully enriched ISBN: ${normalizedISBN}`);
    return enrichedData;
  } catch (error) {
    console.error(`[OpenLibrary] Error fetching ISBN ${normalizedISBN}:`, error.message);

    // Cache the failure (null) to avoid repeated failed requests
    enrichmentCache.set(normalizedISBN, { data: null, cachedAt: Date.now() });
    return null;
  }
}

/**
 * Batch enrich multiple listings with Open Library data
 * Respects rate limits by introducing delays between calls
 */
async function enrichBooksInBatch(listings, delayMs = 100) {
  const enriched = [];

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const enrichmentData = await enrichBookData(listing.isbn);

    enriched.push({
      ...listing,
      openLibraryData: enrichmentData || {},
    });

    // Add delay between calls to respect rate limits (10 req/sec = 100ms min)
    if (i < listings.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return enriched;
}

/**
 * Get cache statistics for monitoring
 */
function getCacheStats() {
  return {
    cacheSize: enrichmentCache.size,
    cachedISBNs: Array.from(enrichmentCache.keys()),
    hitRate: 0, // TODO: Track hits/misses for analytics
  };
}

/**
 * Clear expired cache entries
 */
function clearExpiredCacheEntries() {
  let cleared = 0;
  for (const [isbn, entry] of enrichmentCache.entries()) {
    if (Date.now() - entry.cachedAt >= CACHE_TTL_MS) {
      enrichmentCache.delete(isbn);
      cleared++;
    }
  }
  console.log(`[OpenLibrary] Cleared ${cleared} expired cache entries`);
  return cleared;
}

module.exports = {
  enrichBookData,
  enrichBooksInBatch,
  getCacheStats,
  clearExpiredCacheEntries,
};
