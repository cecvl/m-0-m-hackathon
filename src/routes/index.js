const express = require("express");
const {
  createListingHandler,
  listBooksHandler,
} = require("../controllers/listingController");
const {
  createOrderHandler,
  getOrderHandler,
  markDispatchedHandler,
  markDeliveredHandler,
  confirmReceiptHandler,
  listSellerOrdersHandler,
} = require("../controllers/orderController");
const {
  initiateStkHandler,
  callbackHandler,
} = require("../controllers/paymentController");
const {
  getStateHandler,
  autoReleaseNowHandler,
  getReconciliationHandler,
} = require("../controllers/adminController");
const { attachActor, requireRole } = require("../middleware/roles");

const router = express.Router();

router.use(attachActor);

router.get("/health", (req, res) => {
  res.json({ success: true, data: { service: "backend-prototype", status: "ok" } });
});

router.post("/api/listings", requireRole(["seller", "admin"]), createListingHandler);
router.get("/api/listings", listBooksHandler);

router.post("/api/orders", createOrderHandler);
router.get("/api/orders/:id", requireRole(["buyer", "seller", "admin"]), getOrderHandler);
router.get("/api/seller/orders", requireRole(["seller", "admin"]), listSellerOrdersHandler);
router.post("/api/orders/:id/dispatch", requireRole(["seller", "admin"]), markDispatchedHandler);
router.post("/api/orders/:id/delivered", requireRole(["seller", "admin"]), markDeliveredHandler);
router.post("/api/orders/:id/confirm", requireRole(["buyer", "admin"]), confirmReceiptHandler);

router.post("/api/payments/stk/initiate", initiateStkHandler);
router.post("/api/payments/stk/callback", callbackHandler);

router.get("/api/admin/state", requireRole(["admin"]), getStateHandler);
router.get("/api/admin/reconciliation", requireRole(["admin"]), getReconciliationHandler);
router.post("/api/admin/escrow/auto-release", requireRole(["admin"]), autoReleaseNowHandler);

module.exports = router;
