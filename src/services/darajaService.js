const { env } = require("../config/env");

function getDarajaBaseUrl() {
  return env.mpesaEnv === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function createTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

async function getAccessToken() {
  if (!env.mpesaConsumerKey || !env.mpesaConsumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const credentials = Buffer.from(`${env.mpesaConsumerKey}:${env.mpesaConsumerSecret}`).toString("base64");
  const response = await fetch(
    `${getDarajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    },
  );

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(body.errorMessage || body.error_description || "Failed to get Daraja access token");
  }

  return body.access_token;
}

async function initiateStkPush({ phone, amount, orderId }) {
  if (!env.mpesaPasskey) {
    throw new Error("Missing MPESA_PASSKEY");
  }
  if (!env.mpesaCallbackUrl) {
    throw new Error("Missing MPESA_CALLBACK_URL");
  }

  const timestamp = createTimestamp();
  const password = Buffer.from(`${env.mpesaShortcode}${env.mpesaPasskey}${timestamp}`).toString("base64");
  const token = await getAccessToken();

  const payload = {
    BusinessShortCode: env.mpesaShortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Number(amount),
    PartyA: phone,
    PartyB: env.mpesaShortcode,
    PhoneNumber: phone,
    CallBackURL: env.mpesaCallbackUrl,
    AccountReference: `ORDER-${orderId}`,
    TransactionDesc: `Book order ${orderId}`,
  };

  const response = await fetch(`${getDarajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  const requestAccepted = String(body.ResponseCode || "") === "0";

  if (!response.ok || !requestAccepted) {
    throw new Error(body.errorMessage || body.ResponseDescription || "Daraja STK push failed");
  }

  return {
    merchantRequestId: body.MerchantRequestID,
    checkoutRequestId: body.CheckoutRequestID,
    customerMessage: body.CustomerMessage || null,
    responseCode: body.ResponseCode,
    responseDescription: body.ResponseDescription,
    raw: body,
  };
}

module.exports = {
  initiateStkPush,
};
