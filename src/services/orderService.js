const { randomUUID } = require("crypto");
const { db, nowIso, createPhoneUser, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");
const { findListingById } = require("../data/listingRepository");

const DELIVERY_FEE = 150;

async function createOrder({ bookId, buyerPhone }) {
  let book = db.books.get(bookId);
  if (!book) {
    try {
      const fromMongo = await findListingById(bookId);
      if (fromMongo) {
        db.books.set(fromMongo.id, fromMongo);
        book = fromMongo;
      }
    } catch (error) {
      console.warn("MongoDB listing lookup failed, checking in-memory only:", error.message);
    }
  }

  if (!book || !book.available) {
    return { error: "Book not found or unavailable", status: 404 };
  }

  createPhoneUser(buyerPhone);
  createPhoneUser(book.sellerPhone);

  const order = {
    id: randomUUID(),
    bookId,
    buyerPhone,
    sellerPhone: book.sellerPhone,
    listingPrice: book.price,
    deliveryFee: DELIVERY_FEE,
    totalAmount: book.price + DELIVERY_FEE,
    status: ORDER_STATUS.PENDING_PAYMENT,
    pickupPointId: null,
    conditionConfirmed: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    paidAt: null,
    deliveredAt: null,
    releasedAt: null,
  };

  db.orders.set(order.id, order);
  appendLedgerEntry({
    orderId: order.id,
    type: "ORDER_CREATED",
    amount: order.totalAmount,
    note: "Buyer initiated order",
  });

  return { data: order };
}

function getOrder(orderId, actor = {}) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (actor.role === "buyer" && actor.phone && actor.phone !== order.buyerPhone) {
    return { error: "Buyer not allowed to access this order", status: 403 };
  }
  if (actor.role === "seller" && actor.phone && actor.phone !== order.sellerPhone) {
    return { error: "Seller not allowed to access this order", status: 403 };
  }

  return { data: order };
}

function markDispatched(orderId, pickupPointId, actor = {}) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (actor.phone && actor.phone !== order.sellerPhone) {
    return { error: "Only the seller can mark order as dispatched", status: 403 };
  }
  if (order.status !== ORDER_STATUS.PAID_HELD) {
    return { error: "Order must be PAID_HELD before dispatch", status: 409 };
  }

  order.status = ORDER_STATUS.DISPATCHED;
  order.pickupPointId = pickupPointId;
  order.updatedAt = nowIso();
  return { data: order };
}

function markDelivered(orderId, actor = {}) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (actor.phone && actor.phone !== order.sellerPhone) {
    return { error: "Only the seller can mark order as delivered", status: 403 };
  }
  if (order.status !== ORDER_STATUS.DISPATCHED) {
    return { error: "Order must be DISPATCHED before delivery", status: 409 };
  }

  order.status = ORDER_STATUS.DELIVERED;
  order.deliveredAt = nowIso();
  order.updatedAt = nowIso();
  return { data: order };
}

function listSellerOrders(sellerPhone) {
  const orders = Array.from(db.orders.values())
    .filter((order) => order.sellerPhone === sellerPhone)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { data: orders };
}

module.exports = {
  DELIVERY_FEE,
  createOrder,
  getOrder,
  markDispatched,
  markDelivered,
  listSellerOrders,
};
