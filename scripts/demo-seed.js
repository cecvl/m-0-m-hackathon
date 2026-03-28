/* eslint-disable no-console */

const baseUrl = process.env.BASE_URL || "http://localhost:4000";

async function post(path, body, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`POST ${path} failed: ${JSON.stringify(json)}`);
  }

  return json.data;
}

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`GET ${path} failed: ${JSON.stringify(json)}`);
  }

  return json.data;
}

async function run() {
  console.log("Seeding demo happy path...");

  const listing = await post("/api/listings", {
    title: "The Alchemist",
    author: "Paulo Coelho",
    isbn: "9780061122415",
    condition: "Good",
    price: 350,
    description: "Minor wear on cover, pages intact and readable.",
    sellerPhone: "254700111222",
  });

  const order = await post("/api/orders", {
    bookId: listing.id,
    buyerPhone: "254700999888",
  });

  const tx = await post("/api/payments/stk/initiate", {
    orderId: order.id,
    phone: "254700999888",
  });

  await post("/api/payments/stk/callback", {
    transactionId: tx.id,
    resultCode: 0,
    mpesaReceipt: "DEMO-RECEIPT-001",
    callbackEventId: `seed-${Date.now()}`,
  });

  await post(`/api/orders/${order.id}/dispatch`, {
    pickupPointId: "pickup-nairobi-cbd",
  });

  await post(`/api/orders/${order.id}/delivered`, {});

  const confirmation = await post(`/api/orders/${order.id}/confirm`, {
    conditionMatches: true,
  });

  const reconciliation = await get("/api/admin/reconciliation");

  console.log("Demo seed complete.");
  console.log(
    JSON.stringify(
      {
        listingId: listing.id,
        orderId: order.id,
        transactionId: tx.id,
        orderStatus: confirmation.order.status,
        reconciliationSummary: reconciliation.summary,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
