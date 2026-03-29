const { z } = require("zod");
const { initiateStkPush, handlePaymentCallback } = require("../services/paymentService");
const { ok, fail } = require("../utils/response");

const initiateSchema = z.object({
  orderId: z.string().min(1),
  phone: z.string().min(10),
  idempotencyKey: z.string().min(8).optional(),
});

const callbackSchema = z.object({
  transactionId: z.string().min(1),
  resultCode: z.number().int(),
  mpesaReceipt: z.string().optional(),
  callbackEventId: z.string().optional(),
});

function initiateStkHandler(req, res) {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid payment request payload", 422, parsed.error.flatten());
  }

  const result = initiateStkPush(parsed.data);
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, {
    transaction: result.data,
    warning: result.warning || null,
  }, 201);
}

function callbackHandler(req, res) {
  const parsed = callbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid callback payload", 422, parsed.error.flatten());
  }

  const result = handlePaymentCallback({
    ...parsed.data,
    callbackSignature: req.headers["x-callback-signature"],
  });
  if (result.error) {
    return fail(res, result.error, result.status);
  }

  return ok(res, {
    transaction: result.data,
    warning: result.warning || null,
  });
}

module.exports = {
  initiateStkHandler,
  callbackHandler,
};
