const { randomUUID, createHash } = require("crypto");
const { env } = require("../config/env");
const { db, nowIso, appendLedgerEntry } = require("../data/store");
const { ORDER_STATUS } = require("../utils/constants");
const { signCallbackPayload, safeEqualHex } = require("../utils/signature");
const { initiateStkPush: initiateDarajaStkPush } = require("./darajaService");

async function initiateStkPush({ orderId, phone, idempotencyKey }) {
  const order = db.orders.get(orderId);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  if (order.buyerPhone !== phone) {
    return { error: "Payment phone must match order buyer phone", status: 403 };
  }

  if (idempotencyKey && db.paymentInitiationKeys.has(idempotencyKey)) {
    const existingTxId = db.paymentInitiationKeys.get(idempotencyKey);
    const existingTx = db.transactions.get(existingTxId);
    if (existingTx) {
      return { data: existingTx, warning: "Duplicate initiation request returned existing transaction" };
    }
  }

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return { error: "Order is not awaiting payment", status: 409 };
  }

  const provider = env.paymentProvider === "daraja" ? "MPESA_DARAJA" : "MPESA_MOCK";

  let providerResponse = null;
  if (provider === "MPESA_DARAJA") {
    try {
      providerResponse = await initiateDarajaStkPush({
        phone,
        amount: order.totalAmount,
        orderId: order.id,
      });
    } catch (error) {
      return { error: `Daraja initiation failed: ${error.message}`, status: 502 };
    }
  }

  const transaction = {
    id: randomUUID(),
    orderId,
    phone,
    amount: order.totalAmount,
    provider,
    status: "PENDING",
    reconciliationStatus: "PENDING_CALLBACK",
    callbackAttempts: 0,
    callbackHistory: [],
    checkoutRequestId: providerResponse?.checkoutRequestId || `mock-${randomUUID()}`,
    merchantRequestId: providerResponse?.merchantRequestId || `merchant-${randomUUID()}`,
    providerMeta: providerResponse
      ? {
          customerMessage: providerResponse.customerMessage,
          responseCode: providerResponse.responseCode,
          responseDescription: providerResponse.responseDescription,
        }
      : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    idempotencyKey: idempotencyKey || null,
  };

  db.transactions.set(transaction.id, transaction);
  db.checkoutRequestToTransaction.set(transaction.checkoutRequestId, transaction.id);

  if (idempotencyKey) {
    db.paymentInitiationKeys.set(idempotencyKey, transaction.id);
  }

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

function resolveTransactionId({ transactionId, checkoutRequestId }) {
  if (transactionId) {
    return transactionId;
  }

  if (!checkoutRequestId) {
    return null;
  }

  return db.checkoutRequestToTransaction.get(checkoutRequestId) || null;
}

function handlePaymentCallback({
  transactionId,
  checkoutRequestId,
  resultCode,
  resultDesc,
  mpesaReceipt,
  callbackEventId,
  callbackSignature,
}) {
  const resolvedTransactionId = resolveTransactionId({ transactionId, checkoutRequestId });
  const payload = {
    transactionId: resolvedTransactionId,
    checkoutRequestId,
    resultCode,
    resultDesc,
    mpesaReceipt,
    callbackEventId,
  };
  const signatureCheck = verifyCallbackSignature(payload, callbackSignature);
  if (!signatureCheck.valid) {
    return { error: "Invalid callback signature", status: 401 };
  }

  const eventId = buildEventId(payload);
  if (db.callbackEvents.has(eventId)) {
    const event = db.callbackEvents.get(eventId);
    return {
      data: db.transactions.get(event.transactionId),
      warning: "Duplicate callback event ignored",
    };
  }

  if (!resolvedTransactionId) {
    return { error: "Transaction could not be resolved from callback payload", status: 404 };
  }

  const tx = db.transactions.get(resolvedTransactionId);
  if (!tx) {
    return { error: "Transaction not found", status: 404 };
  }

  tx.callbackAttempts += 1;
  tx.lastCallbackAt = nowIso();
  tx.resultCode = resultCode;
  tx.resultDesc = resultDesc || (resultCode === 0 ? "Success" : "Failed");

  if (tx.status !== "PENDING") {
    db.callbackEvents.set(eventId, {
      eventId,
      transactionId: tx.id,
      recordedAt: nowIso(),
      resultCode,
      duplicate: true,
    });
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

  db.callbackEvents.set(eventId, {
    eventId,
    transactionId: tx.id,
    checkoutRequestId: tx.checkoutRequestId,
    recordedAt: nowIso(),
    resultCode,
    duplicate: false,
  });

  return { data: tx };
}

module.exports = {
  initiateStkPush,
  handlePaymentCallback,
};
