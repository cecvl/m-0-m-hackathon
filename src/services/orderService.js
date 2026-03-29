const { randomUUID } = require("crypto");
const { db, nowIso, createPhoneUser, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");
const { findListingById } = require("../data/listingRepository");
const { saveOrder, findOrderById, findOrdersBySeller } = require("../data/orderRepository");
const { appendLedgerEntry: appendLedgerEntryToMongo } = require("../data/ledgerRepository");
const { sendSMS } = require("./smsService");
const { bookDelivery, pickupItem, completeDelivery } = require("./courierService");

const DELIVERY_FEE = 150;

async function persistOrder(order) {
  try {
    await saveOrder(order);
  } catch (error) {
    console.warn("MongoDB order save failed, continuing in-memory:", error.message);
  }
}

async function persistLedger(entry) {
  try {
    await appendLedgerEntryToMongo(entry);
  } catch (error) {
    console.warn("MongoDB ledger save failed, continuing in-memory:", error.message);
  }
}

async function loadOrder(orderId) {
  let order = db.orders.get(orderId);
  if (order) {
    return order;
  }

  try {
    const fromMongo = await findOrderById(orderId);
    if (fromMongo) {
      db.orders.set(fromMongo.id, fromMongo);
      order = fromMongo;
    }
  } catch (error) {
    console.warn("MongoDB order lookup failed, checking in-memory only:", error.message);
  }

  return order;
}

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
    courierBookingId: null,
    courierStatus: null,
    courierTrackingUrl: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    paidAt: null,
    deliveredAt: null,
    releasedAt: null,
  };

  db.orders.set(order.id, order);
  await persistOrder(order);

  const ledgerEntry = appendLedgerEntry({
    orderId: order.id,
    type: "ORDER_CREATED",
    amount: order.totalAmount,
    note: "Buyer initiated order",
  });
  await persistLedger(ledgerEntry);

  (async () => {
    try {
      await sendSMS(
        buyerPhone,
        `Order created: ${book.title}. Amount: KSH ${order.totalAmount}. Pending payment.`
      );
      await sendSMS(
        book.sellerPhone,
        `New order for "${book.title}". Awaiting buyer payment. Order ID: ${order.id}`
      );
    } catch (error) {
      console.error("SMS notification failed:", error.message);
    }
  })();

  return { data: order };
}

async function getOrder(orderId, actor = {}) {
  const order = await loadOrder(orderId);
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

async function markDispatched(orderId, pickupPointId, actor = {}) {
  const order = await loadOrder(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (actor.phone && actor.phone !== order.sellerPhone) {
    return { error: "Only the seller can mark order as dispatched", status: 403 };
  }
  if (order.status !== ORDER_STATUS.PAID_HELD) {
    return { error: "Order must be PAID_HELD before dispatch", status: 409 };
  }

  const pickupPoint = db.pickupPoints.find((p) => p.id === pickupPointId);
  if (!pickupPoint) {
    return { error: "Pickup point not found", status: 404 };
  }

  const bookingResult = bookDelivery({
    orderId: order.id,
    pickupPointId,
    dropOffLocation: order.buyerPhone,
    itemDescription: `Book order ${order.bookId}`,
    deliveryFee: order.deliveryFee,
  });

  if (!bookingResult.success) {
    return bookingResult;
  }

  const pickupResult = pickupItem({
    courierBookingId: bookingResult.data.courierBookingId,
    pickupLocation: pickupPoint.name,
  });

  order.status = ORDER_STATUS.DISPATCHED;
  order.pickupPointId = pickupPointId;
  order.courierBookingId = bookingResult.data.courierBookingId;
  order.courierStatus = pickupResult?.data?.status || bookingResult.data.status;
  order.courierTrackingUrl = bookingResult.data.trackingUrl;
  order.updatedAt = nowIso();

  db.orders.set(order.id, order);
  await persistOrder(order);

  const ledgerEntry = appendLedgerEntry({
    orderId: order.id,
    type: "COURIER_DELIVERY_BOOKED",
    amount: order.deliveryFee,
    note: `Courier booking ${order.courierBookingId} created for pickup point ${pickupPointId}`,
  });
  await persistLedger(ledgerEntry);

  (async () => {
    try {
      await sendSMS(
        order.buyerPhone,
        `Your book is in transit via courier. Pickup: ${pickupPoint.name}. Track: ${order.courierTrackingUrl}`
      );
    } catch (error) {
      console.error("SMS dispatch notification failed:", error.message);
    }
  })();

  return { data: order };
}

async function markDelivered(orderId, actor = {}) {
  const order = await loadOrder(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }
  if (actor.phone && actor.phone !== order.sellerPhone) {
    return { error: "Only the seller can mark order as delivered", status: 403 };
  }
  if (order.status !== ORDER_STATUS.DISPATCHED) {
    return { error: "Order must be DISPATCHED before delivery", status: 409 };
  }

  if (order.courierBookingId) {
    const deliveryResult = completeDelivery({
      courierBookingId: order.courierBookingId,
      deliveryProof: "seller_marked_delivered",
    });
    if (!deliveryResult.success) {
      return deliveryResult;
    }
    order.courierStatus = deliveryResult.data.status;
  }

  order.status = ORDER_STATUS.DELIVERED;
  order.deliveredAt = nowIso();
  order.updatedAt = nowIso();

  db.orders.set(order.id, order);
  await persistOrder(order);

  const ledgerEntry = appendLedgerEntry({
    orderId: order.id,
    type: "COURIER_DELIVERY_CONFIRMED",
    amount: 0,
    note: `Courier status updated to ${order.courierStatus || "DELIVERED"}`,
  });
  await persistLedger(ledgerEntry);

  (async () => {
    try {
      await sendSMS(
        order.buyerPhone,
        `Your book has arrived. Confirm receipt within 7 days or funds auto-release to seller. Order ID: ${orderId}`
      );
    } catch (error) {
      console.error("SMS delivery notification failed:", error.message);
    }
  })();

  return { data: order };
}

async function listSellerOrders(sellerPhone) {
  try {
    const fromMongo = await findOrdersBySeller(sellerPhone);
    if (Array.isArray(fromMongo)) {
      for (const order of fromMongo) {
        db.orders.set(order.id, order);
      }
      return { data: fromMongo };
    }
  } catch (error) {
    console.warn("MongoDB seller orders lookup failed, using in-memory:", error.message);
  }

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
