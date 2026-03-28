const crypto = require("crypto");

function signCallbackPayload({ transactionId, resultCode, mpesaReceipt, callbackEventId }, secret) {
  const raw = [
    transactionId || "",
    String(resultCode ?? ""),
    mpesaReceipt || "",
    callbackEventId || "",
  ].join("|");

  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

module.exports = {
  signCallbackPayload,
  safeEqualHex,
};
