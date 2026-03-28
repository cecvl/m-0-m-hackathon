const env = {
  port: Number(process.env.PORT || 4000),
  autoReleaseDays: Number(process.env.AUTO_RELEASE_DAYS || 7),
  platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 0.1),
  requireCallbackSignature: process.env.REQUIRE_CALLBACK_SIGNATURE === "true",
  mpesaCallbackSecret: process.env.MPESA_CALLBACK_SECRET || "dev-mpesa-callback-secret",
};

module.exports = { env };
