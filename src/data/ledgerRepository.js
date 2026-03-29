const { getMongoDb } = require("./mongo");

let ledgerIndexesReady = false;

async function getLedgerCollection() {
  const db = await getMongoDb();
  if (!db) {
    return null;
  }

  const collection = db.collection("ledger");
  if (!ledgerIndexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ orderId: 1 });
    await collection.createIndex({ type: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ transactionId: 1 });
    ledgerIndexesReady = true;
  }

  return collection;
}

/**
 * Append a ledger entry (immutable record)
 */
async function appendLedgerEntry(entry) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return false;
  }

  const result = await collection.insertOne({
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString(),
  });

  return result.insertedId ? true : false;
}

/**
 * Get ledger entries for an order
 */
async function findLedgerByOrderId(orderId) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ orderId })
    .sort({ createdAt: 1 })
    .toArray();

  return results.map(({ _id, ...entry }) => entry);
}

/**
 * Get ledger entries by type
 */
async function findLedgerByType(type) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ type })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...entry }) => entry);
}

/**
 * Get all ledger entries (for reconciliation/admin)
 */
async function findAllLedgerEntries(limit = 10000) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map(({ _id, ...entry }) => entry);
}

/**
 * Get ledger entries within a date range (for reporting)
 */
async function findLedgerByDateRange(startDate, endDate) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...entry }) => entry);
}

/**
 * Calculate total amounts by type (for reconciliation)
 */
async function sumLedgerByType(type) {
  const collection = await getLedgerCollection();
  if (!collection) {
    return 0;
  }

  const results = await collection
    .aggregate([
      { $match: { type } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  return results?.[0]?.total || 0;
}

module.exports = {
  getLedgerCollection,
  appendLedgerEntry,
  findLedgerByOrderId,
  findLedgerByType,
  findAllLedgerEntries,
  findLedgerByDateRange,
  sumLedgerByType,
};
