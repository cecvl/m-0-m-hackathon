const { randomUUID, createHash } = require("crypto");
const { env } = require("../config/env");
const { db, nowIso, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");
const { signCallbackPayload, safeEqualHex } = require("../utils/signature");

function initiateStkPush(orderId, phone) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return { error: "Order is not awaiting payment", status: 409 };
  }

  const transaction = {
    id: randomUUID(),
    orderId,
    phone,
    amount: order.totalAmount,
    provider: "MPESA_MOCK",
    status: "PENDING",
    reconciliationStatus: "PENDING_CALLBACK",
    callbackAttempts: 0,
    callbackHistory: [],
    checkoutRequestId: `mock-${randomUUID()}`,
    merchantRequestId: `merchant-${randomUUID()}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.transactions.set(transaction.id, transaction);
  return { data: transaction };
}

function buildEventId(payload) {
  if (payload.callbackEventId) {
    return payload.callbackEventId;
  }

  return createHash("sha256")
    .update(
      [
        payload.transactionId || "",
        String(payload.resultCode ?? ""),
        payload.mpesaReceipt || "",
      ].join("|"),
    )
    .digest("hex");
}

function verifyCallbackSignature(payload, providedSignature) {
  if (!env.requireCallbackSignature) {
    return { valid: true };
  }

  const expected = signCallbackPayload(payload, env.mpesaCallbackSecret);
  const valid = safeEqualHex(expected, providedSignature);
  return { valid, expected };
}

function handlePaymentCallback({ transactionId, resultCode, mpesaReceipt, callbackEventId, callbackSignature }) {
  const payload = { transactionId, resultCode, mpesaReceipt, callbackEventId };
  const signatureCheck = verifyCallbackSignature(payload, callbackSignature);
  if (!signatureCheck.valid) {
    return { error: "Invalid callback signature", status: 401 };
  }

  const eventId = buildEventId(payload);
  if (db.callbackEvents.has(eventId)) {
    return {
      data: db.callbackEvents.get(eventId),
      warning: "Duplicate callback event ignored",
    };
  }

  const tx = db.transactions.get(transactionId);
  if (!tx) {
    return { error: "Transaction not found", status: 404 };
  }

  tx.callbackAttempts += 1;
  tx.lastCallbackAt = nowIso();
  tx.resultCode = resultCode;
  tx.resultDesc = resultCode === 0 ? "Success" : "Failed";

  if (tx.status !== "PENDING") {
    db.callbackEvents.set(eventId, tx);
    return { data: tx, warning: "Callback already processed" };
  }

  const order = db.orders.get(tx.orderId);
  if (!order) {
    return { error: "Order linked to transaction was not found", status: 404 };
  }

  tx.status = resultCode === 0 ? "SUCCESS" : "FAILED";
  tx.reconciliationStatus = tx.status === "SUCCESS" ? "RECONCILED" : "PAYMENT_FAILED";
  tx.updatedAt = nowIso();
  tx.mpesaReceipt = mpesaReceipt || null;
  tx.callbackHistory.push({ eventId, receivedAt: nowIso(), resultCode, mpesaReceipt: mpesaReceipt || null });

  if (tx.status === "SUCCESS") {
    order.status = ORDER_STATUS.PAID_HELD;
    order.paidAt = nowIso();
    order.updatedAt = nowIso();

    appendLedgerEntry({
      orderId: order.id,
      transactionId: tx.id,
      type: "ESCROW_HOLD",
      amount: tx.amount,
      note: "Funds held in platform escrow wallet",
    });
  }

  db.callbackEvents.set(eventId, tx);

  return { data: tx };
}

module.exports = {
  initiateStkPush,
  handlePaymentCallback,
};
