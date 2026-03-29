const { env } = require("../config/env");
const { db, nowIso, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");
const { sendSMS } = require("./smsService");

function releaseToSeller(orderId, reason = "buyer_confirmed") {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.PAID_HELD].includes(order.status)) {
    return { error: "Order is not eligible for release", status: 409 };
  }

  const commission = Math.round(order.listingPrice * env.platformCommissionRate);
  const sellerAmount = order.listingPrice - commission;

  order.status = ORDER_STATUS.RELEASED;
  order.releasedAt = nowIso();
  order.updatedAt = nowIso();

  appendLedgerEntry({
    orderId: order.id,
    type: "DELIVERY_FEE_TRANSFER",
    amount: order.deliveryFee,
    note: "Delivery fee reserved for courier partner",
  });

  appendLedgerEntry({
    orderId: order.id,
    type: "SELLER_PAYOUT",
    amount: sellerAmount,
    note: `Release reason: ${reason}`,
  });

  appendLedgerEntry({
    orderId: order.id,
    type: "PLATFORM_COMMISSION",
    amount: commission,
    note: "Platform fee retained",
  });

  const seller = db.users.get(order.sellerPhone);
  if (seller) {
    seller.booksSoldCount += 1;
  }

  // Fire-and-forget notifications; release flow must not fail on SMS errors.
  (async () => {
    try {
      await sendSMS(
        order.sellerPhone,
        `Funds released: KSH ${sellerAmount}. Delivery fee: KSH ${order.deliveryFee}. Commission: KSH ${commission}.`
      );
      await sendSMS(
        order.buyerPhone,
        `Transaction complete. Seller payout released for order ${orderId}.`
      );
    } catch (error) {
      console.error("SMS release notification failed:", error.message);
    }
  })();

  return {
    data: {
      order,
      payout: {
        sellerAmount,
        commission,
        deliveryFee: order.deliveryFee,
      },
    },
  };
}

function createDispute({ orderId, reason, buyerEvidence }) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.PAID_HELD].includes(order.status)) {
    return { error: "Order is not eligible for dispute", status: 409 };
  }

  order.status = ORDER_STATUS.DISPUTED;
  order.updatedAt = nowIso();

  const dispute = {
    id: `dispute-${orderId}`,
    orderId,
    reason,
    buyerEvidence: buyerEvidence || [],
    sellerResponse: null,
    status: "OPEN",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.disputes.set(orderId, dispute);

  appendLedgerEntry({
    orderId,
    type: "DISPUTE_HOLD",
    amount: 0,
    note: reason,
  });

  // Fire-and-forget notifications; dispute creation must not fail on SMS errors.
  (async () => {
    try {
      await sendSMS(
        order.sellerPhone,
        `Dispute alert for order ${orderId}. Reason: ${reason}. Please respond within 24 hours.`
      );
      await sendSMS(
        order.buyerPhone,
        "Dispute created. Funds remain in escrow during review."
      );
    } catch (error) {
      console.error("SMS dispute notification failed:", error.message);
    }
  })();

  return { data: dispute };
}

function confirmReceipt({ orderId, conditionMatches, evidencePhotos, actor = {} }) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (actor.role === "buyer" && actor.phone && actor.phone !== order.buyerPhone) {
    return { error: "Only the buyer can confirm this order", status: 403 };
  }

  if (conditionMatches === false) {
    return createDispute({
      orderId,
      reason: "Item not as described",
      buyerEvidence: evidencePhotos,
    });
  }

  return releaseToSeller(orderId, "buyer_confirmed");
}

function autoReleaseEligibleOrders() {
  const now = Date.now();
  const maxMs = env.autoReleaseDays * 24 * 60 * 60 * 1000;
  const released = [];

  for (const order of db.orders.values()) {
    if (order.status !== ORDER_STATUS.DELIVERED) {
      continue;
    }
    if (!order.deliveredAt) {
      continue;
    }
    const ageMs = now - new Date(order.deliveredAt).getTime();
    if (ageMs < maxMs) {
      continue;
    }

    const result = releaseToSeller(order.id, "auto_release");
    if (!result.error) {
      released.push(order.id);
    }
  }

  return released;
}

module.exports = {
  releaseToSeller,
  createDispute,
  confirmReceipt,
  autoReleaseEligibleOrders,
};
