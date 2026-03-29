const { db } = require("../data/store");
const { autoReleaseEligibleOrders } = require("../services/escrowService");
const { ok } = require("../utils/response");
const { getDeliveryStats } = require("../services/courierService");

function getStateHandler(req, res) {
  return ok(res, {
    users: Array.from(db.users.values()),
    books: Array.from(db.books.values()),
    orders: Array.from(db.orders.values()),
    transactions: Array.from(db.transactions.values()),
    disputes: Array.from(db.disputes.values()),
    ledger: db.ledger,
    pickupPoints: db.pickupPoints,
  });
}

function autoReleaseNowHandler(req, res) {
  const releasedOrderIds = autoReleaseEligibleOrders();
  return ok(res, {
    releasedCount: releasedOrderIds.length,
    releasedOrderIds,
  });
}

function getReconciliationHandler(req, res) {
  const transactions = Array.from(db.transactions.values());
  const summary = {
    total: transactions.length,
    pending: transactions.filter((tx) => tx.reconciliationStatus === "PENDING_CALLBACK").length,
    reconciled: transactions.filter((tx) => tx.reconciliationStatus === "RECONCILED").length,
    failed: transactions.filter((tx) => tx.reconciliationStatus === "PAYMENT_FAILED").length,
  };

  const anomalies = transactions
    .map((tx) => {
      const order = db.orders.get(tx.orderId);
      if (!order) {
        return { transactionId: tx.id, issue: "ORDER_MISSING" };
      }
      if (tx.status === "SUCCESS" && order.status === "PENDING_PAYMENT") {
        return { transactionId: tx.id, orderId: order.id, issue: "SUCCESS_TX_BUT_ORDER_NOT_UPDATED" };
      }
      return null;
    })
    .filter(Boolean);

  return ok(res, { summary, anomalies, transactions });
}

function getDeliveriesHandler(req, res) {
  const stats = getDeliveryStats();
  return ok(res, stats);
}

module.exports = {
  getStateHandler,
  autoReleaseNowHandler,
  getReconciliationHandler,
  getDeliveriesHandler,
};
