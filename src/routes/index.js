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

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ success: true, data: { service: "backend-prototype", status: "ok" } });
});

router.post("/api/listings", createListingHandler);
router.get("/api/listings", listBooksHandler);

router.post("/api/orders", createOrderHandler);
router.get("/api/orders/:id", getOrderHandler);
router.post("/api/orders/:id/dispatch", markDispatchedHandler);
router.post("/api/orders/:id/delivered", markDeliveredHandler);
router.post("/api/orders/:id/confirm", confirmReceiptHandler);

router.post("/api/payments/stk/initiate", initiateStkHandler);
router.post("/api/payments/stk/callback", callbackHandler);

router.get("/api/admin/state", getStateHandler);
router.get("/api/admin/reconciliation", getReconciliationHandler);
router.post("/api/admin/escrow/auto-release", autoReleaseNowHandler);

module.exports = router;
