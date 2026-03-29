const { getMongoDb } = require("./mongo");

let transactionsIndexesReady = false;

async function getTransactionsCollection() {
  const db = await getMongoDb();
  if (!db) {
    return null;
  }

  const collection = db.collection("transactions");
  if (!transactionsIndexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ orderId: 1 });
    await collection.createIndex({ phone: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ checkoutRequestId: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ reconciliationStatus: 1 });
    transactionsIndexesReady = true;
  }

  return collection;
}

/**
 * Save or update a transaction
 */
async function saveTransaction(transaction) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return false;
  }

  await collection.updateOne(
    { id: transaction.id },
    { $set: transaction },
    { upsert: true }
  );
  return true;
}

/**
 * Get transaction by ID
 */
async function findTransactionById(transactionId) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const transaction = await collection.findOne({ id: transactionId });
  if (!transaction) {
    return undefined;
  }

  const { _id, ...clean } = transaction;
  return clean;
}

/**
 * Get transaction by checkout request ID
 */
async function findTransactionByCheckoutRequestId(checkoutRequestId) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const transaction = await collection.findOne({ checkoutRequestId });
  if (!transaction) {
    return undefined;
  }

  const { _id, ...clean } = transaction;
  return clean;
}

/**
 * Get transactions by order ID
 */
async function findTransactionsByOrderId(orderId) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ orderId })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...tx }) => tx);
}

/**
 * Get transactions by phone
 */
async function findTransactionsByPhone(phone) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ phone })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...tx }) => tx);
}

/**
 * Get all transactions (for admin/reconciliation)
 */
async function findAllTransactions(limit = 1000) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map(({ _id, ...tx }) => tx);
}

/**
 * Get transactions by reconciliation status (for bookkeeping)
 */
async function findTransactionsByReconciliationStatus(status) {
  const collection = await getTransactionsCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ reconciliationStatus: status })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...tx }) => tx);
}

module.exports = {
  getTransactionsCollection,
  saveTransaction,
  findTransactionById,
  findTransactionByCheckoutRequestId,
  findTransactionsByOrderId,
  findTransactionsByPhone,
  findAllTransactions,
  findTransactionsByReconciliationStatus,
};
