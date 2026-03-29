const { z } = require("zod");
const {
  createOrder,
  getOrder,
  markDispatched,
  markDelivered,
  listSellerOrders,
} = require("../services/orderService");
const { confirmReceipt } = require("../services/escrowService");
const { ok, fail } = require("../utils/response");

const createOrderSchema = z.object({
  bookId: z.string().min(1),
  buyerPhone: z.string().min(10),
});

const dispatchSchema = z.object({
  pickupPointId: z.string().min(1),
});

const confirmSchema = z.object({
  conditionMatches: z.boolean(),
  evidencePhotos: z.array(z.string().url()).optional(),
});

async function createOrderHandler(req, res) {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid order payload", 422, parsed.error.flatten());
  }

  const result = await createOrder(parsed.data);
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, result.data, 201);
}

function getOrderHandler(req, res) {
  const result = getOrder(req.params.id, req.actor || {});
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, result.data);
}

function markDispatchedHandler(req, res) {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid dispatch payload", 422, parsed.error.flatten());
  }

  const result = markDispatched(req.params.id, parsed.data.pickupPointId, req.actor || {});
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, result.data);
}

function markDeliveredHandler(req, res) {
  const result = markDelivered(req.params.id, req.actor || {});
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, result.data);
}

function confirmReceiptHandler(req, res) {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid confirmation payload", 422, parsed.error.flatten());
  }

  const result = confirmReceipt({ orderId: req.params.id, ...parsed.data, actor: req.actor || {} });
  if (result.error) {
    return fail(res, result.error, result.status);
  }
  return ok(res, result.data);
}

function listSellerOrdersHandler(req, res) {
  const sellerPhone = req.actor?.phone || req.params.phone;
  if (!sellerPhone) {
    return fail(res, "Seller phone is required", 422);
  }

  const result = listSellerOrders(sellerPhone);
  return ok(res, result.data);
}

module.exports = {
  createOrderHandler,
  getOrderHandler,
  markDispatchedHandler,
  markDeliveredHandler,
  confirmReceiptHandler,
  listSellerOrdersHandler,
};
