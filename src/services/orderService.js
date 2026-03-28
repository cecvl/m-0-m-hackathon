const { randomUUID } = require("crypto");
const { db, nowIso, createPhoneUser, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");

const DELIVERY_FEE = 150;

function createOrder({ bookId, buyerPhone }) {
  const book = db.books.get(bookId);
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

function getOrder(orderId) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  return { data: order };
}

function markDispatched(orderId, pickupPointId) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (order.status !== ORDER_STATUS.PAID_HELD) {
    return { error: "Order must be PAID_HELD before dispatch", status: 409 };
  }

  order.status = ORDER_STATUS.DISPATCHED;
  order.pickupPointId = pickupPointId;
  order.updatedAt = nowIso();
  return { data: order };
}

function markDelivered(orderId) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (order.status !== ORDER_STATUS.DISPATCHED) {
    return { error: "Order must be DISPATCHED before delivery", status: 409 };
  }

  order.status = ORDER_STATUS.DELIVERED;
  order.deliveredAt = nowIso();
  order.updatedAt = nowIso();
  return { data: order };
}

module.exports = {
  DELIVERY_FEE,
  createOrder,
  getOrder,
  markDispatched,
  markDelivered,
};
