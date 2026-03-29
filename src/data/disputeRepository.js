const { getMongoDb } = require("./mongo");

let disputesIndexesReady = false;

async function getDisputesCollection() {
  const db = await getMongoDb();
  if (!db) {
    return null;
  }

  const collection = db.collection("disputes");
  if (!disputesIndexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ orderId: 1 }, { unique: true });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ resolvedAt: 1 });
    disputesIndexesReady = true;
  }

  return collection;
}

/**
 * Save or update a dispute
 */
async function saveDispute(dispute) {
  const collection = await getDisputesCollection();
  if (!collection) {
    return false;
  }

  await collection.updateOne(
    { id: dispute.id },
    { $set: dispute },
    { upsert: true }
  );
  return true;
}

/**
 * Get dispute by ID
 */
async function findDisputeById(disputeId) {
  const collection = await getDisputesCollection();
  if (!collection) {
    return null;
  }

  const dispute = await collection.findOne({ id: disputeId });
  if (!dispute) {
    return undefined;
  }

  const { _id, ...clean } = dispute;
  return clean;
}

/**
 * Get dispute by order ID
 */
async function findDisputeByOrderId(orderId) {
  const collection = await getDisputesCollection();
  if (!collection) {
    return null;
  }

  const dispute = await collection.findOne({ orderId });
  if (!dispute) {
    return undefined;
  }

  const { _id, ...clean } = dispute;
  return clean;
}

/**
 * Get disputes by status
 */
async function findDisputesByStatus(status) {
  const collection = await getDisputesCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ status })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...dispute }) => dispute);
}

/**
 * Get all disputes (for admin)
 */
async function findAllDisputes(limit = 1000) {
  const collection = await getDisputesCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map(({ _id, ...dispute }) => dispute);
}

/**
 * Get unresolved disputes (for admin review)
 */
async function findUnresolvedDisputes() {
  const collection = await getDisputesCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ status: { $ne: "RESOLVED" } })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...dispute }) => dispute);
}

module.exports = {
  getDisputesCollection,
  saveDispute,
  findDisputeById,
  findDisputeByOrderId,
  findDisputesByStatus,
  findAllDisputes,
  findUnresolvedDisputes,
};
