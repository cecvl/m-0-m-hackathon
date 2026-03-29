const env = {
  port: Number(process.env.PORT || 4000),
  autoReleaseDays: Number(process.env.AUTO_RELEASE_DAYS || 7),
  platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 0.1),
  requireCallbackSignature: process.env.REQUIRE_CALLBACK_SIGNATURE === "true",
  mpesaCallbackSecret: process.env.MPESA_CALLBACK_SECRET || "dev-mpesa-callback-secret",
  databaseUrl: process.env.DATABASE_URL || "",
  mongoDbName: process.env.MONGO_DB_NAME || "bookmarket",
  paymentProvider: process.env.PAYMENT_PROVIDER || "mock",
  smsProvider: process.env.SMS_PROVIDER || "mock",
  mpesaEnv: process.env.MPESA_ENV || "sandbox",
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || "",
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
  mpesaShortcode: process.env.MPESA_SHORTCODE || "174379",
  mpesaPasskey: process.env.MPESA_PASSKEY || "",
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || "",
  mpesaInitiatorName: process.env.MPESA_INITIATOR_NAME || "",
  mpesaInitiatorPassword: process.env.MPESA_INITIATOR_PASSWORD || "",
  atUsername: process.env.AT_USERNAME || "sandbox",
  atApiKey: process.env.AT_API_KEY || "",
  atSenderId: process.env.AT_SENDER_ID || "",
};

module.exports = { env };
