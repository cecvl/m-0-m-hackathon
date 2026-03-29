const { getMongoDb } = require("./mongo");

let ordersIndexesReady = false;

async function getOrdersCollection() {
  const db = await getMongoDb();
  if (!db) {
    return null;
  }

  const collection = db.collection("orders");
  if (!ordersIndexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ buyerPhone: 1 });
    await collection.createIndex({ sellerPhone: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ bookId: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ deliveredAt: 1, status: 1 }); // For auto-release queries
    ordersIndexesReady = true;
  }

  return collection;
}

/**
 * Save or update an order
 */
async function saveOrder(order) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return false;
  }

  await collection.updateOne(
    { id: order.id },
    { $set: order },
    { upsert: true }
  );
  return true;
}

/**
 * Get order by ID
 */
async function findOrderById(orderId) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const order = await collection.findOne({ id: orderId });
  if (!order) {
    return undefined;
  }

  const { _id, ...clean } = order;
  return clean;
}

/**
 * Get orders by buyer phone
 */
async function findOrdersByBuyer(buyerPhone) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ buyerPhone })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...order }) => order);
}

/**
 * Get orders by seller phone
 */
async function findOrdersBySeller(sellerPhone) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ sellerPhone })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...order }) => order);
}

/**
 * Get orders by status
 */
async function findOrdersByStatus(status) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({ status })
    .sort({ createdAt: -1 })
    .toArray();

  return results.map(({ _id, ...order }) => order);
}

/**
 * Get all orders (for admin)
 */
async function findAllOrders(limit = 1000) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map(({ _id, ...order }) => order);
}

/**
 * Get orders that are DELIVERED but not auto-released
 * Used by auto-release job
 */
async function findDeliveredOrdersForAutoRelease(beforeDate) {
  const collection = await getOrdersCollection();
  if (!collection) {
    return null;
  }

  const results = await collection
    .find({
      status: "DELIVERED",
      deliveredAt: { $lt: beforeDate.toISOString() },
      releasedAt: null,
    })
    .toArray();

  return results.map(({ _id, ...order }) => order);
}

module.exports = {
  getOrdersCollection,
  saveOrder,
  findOrderById,
  findOrdersByBuyer,
  findOrdersBySeller,
  findOrdersByStatus,
  findAllOrders,
  findDeliveredOrdersForAutoRelease,
};
