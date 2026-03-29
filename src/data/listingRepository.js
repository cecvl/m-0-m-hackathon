const { getListingsCollection } = require("./mongo");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function saveListing(listing) {
  const collection = await getListingsCollection();
  if (!collection) {
    return false;
  }

  await collection.updateOne(
    { id: listing.id },
    { $set: listing },
    { upsert: true },
  );
  return true;
}

async function findAvailableListings(query = "") {
  const collection = await getListingsCollection();
  if (!collection) {
    return null;
  }

  const q = query.trim();
  const selector = { available: true };

  if (q) {
    const safePattern = new RegExp(escapeRegExp(q), "i");
    selector.$or = [
      { title: safePattern },
      { author: safePattern },
      { isbn: safePattern },
      { description: safePattern },
    ];
  }

  const results = await collection
    .find(selector)
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...listing }) => listing);
}

async function findListingById(id) {
  const collection = await getListingsCollection();
  if (!collection) {
    return null;
  }

  const listing = await collection.findOne({ id });
  if (!listing) {
    return undefined;
  }

  const { _id, ...clean } = listing;
  return clean;
}

module.exports = {
  saveListing,
  findAvailableListings,
  findListingById,
};
