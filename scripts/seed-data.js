#!/usr/bin/env node

/**
 * Database Seed Script
 * Populates the in-memory database with sample data for development/testing
 * Usage: node scripts/seed-data.js
 */

require("dotenv").config();
const { db, nowIso } = require("../src/data/store");
const { randomUUID } = require("crypto");

// Utility to generate UUIDs
const uuid = () => randomUUID();

function seedDatabase() {
  console.log("[Seed] Starting database seed...\n");

  // ==================== USERS ====================
  console.log("📝 Seeding users...");

  const sellers = [
    {
      phone: "254722100001",
      name: "Alice Kariuki",
      email: "alice@bookmarket.ke",
      role: "seller",
      verified: true,
      idNumber: "12345678",
      booksSoldCount: 15,
      averageRating: 4.8,
      totalEarnings: 45000,
    },
    {
      phone: "254722100002",
      name: "Bob Kipchoge",
      email: "bob@bookmarket.ke",
      role: "seller",
      verified: false,
      idNumber: "87654321",
      booksSoldCount: 2,
      averageRating: 0,
      totalEarnings: 0,
    },
    {
      phone: "254722100003",
      name: "Clara Ngao",
      email: "clara@bookmarket.ke",
      role: "seller",
      verified: true,
      idNumber: "11223344",
      booksSoldCount: 8,
      averageRating: 4.2,
      totalEarnings: 18500,
    },
  ];

  const buyers = [
    {
      phone: "254722101001",
      name: "David Omondi",
      email: "david@example.com",
      role: "buyer",
      purchaseCount: 5,
      totalSpent: 12500,
      averageRating: 4.5,
    },
    {
      phone: "254722101002",
      name: "Eva Mwaura",
      email: "eva@example.com",
      role: "buyer",
      purchaseCount: 12,
      totalSpent: 38000,
      averageRating: 4.9,
    },
    {
      phone: "254722101003",
      name: "Frank Kimani",
      email: "frank@example.com",
      role: "buyer",
      purchaseCount: 0,
      totalSpent: 0,
      averageRating: 0,
    },
  ];

  // Add sellers
  sellers.forEach((seller) => {
    const userRecord = {
      id: uuid(),
      ...seller,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      termsAccepted: true,
      verificationCode: null,
      verificationExpiry: null,
      verificationAttempts: 0,
      bankName: null,
      bankAccount: null,
    };
    db.users.set(seller.phone, userRecord);
    console.log(`  ✓ Seller: ${seller.name} (${seller.phone})`);
  });

  // Add buyers
  buyers.forEach((buyer) => {
    const userRecord = {
      id: uuid(),
      ...buyer,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      termsAccepted: true,
      defaultPhone: buyer.phone,
      savedAddresses: [],
    };
    db.users.set(buyer.phone, userRecord);
    console.log(`  ✓ Buyer: ${buyer.name} (${buyer.phone})`);
  });

  console.log(`✅ Seeded ${sellers.length + buyers.length} users\n`);

  // ==================== LISTINGS ====================
  console.log("📖 Seeding listings...");

  const listings = [
    {
      title: "The Catcher in the Rye",
      author: "J.D. Salinger",
      isbn: "9780316769174",
      condition: "Like New",
      price: 250,
      description:
        "Classic American novel, excellent condition, minimal wear. First edition hardcover. Engaging story about teenage angst.",
      sellerPhone: "254722100001",
    },
    {
      title: "1984",
      author: "George Orwell",
      isbn: "9780451524935",
      condition: "Good",
      price: 180,
      description:
        "Paperback, slight page yellowing but fully readable. No markings. Dystopian masterpiece.",
      sellerPhone: "254722100002",
    },
    {
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      isbn: "9780060935467",
      condition: "Fair",
      price: 120,
      description:
        "Library edition with some wear. Pages intact, spine cracked. Powerful story of justice.",
      sellerPhone: "254722100003",
    },
    {
      title: "Sapiens",
      author: "Yuval Noah Harari",
      isbn: "9780062316097",
      condition: "New",
      price: 400,
      description:
        "Brand new, sealed in plastic. Never opened. Fascinating history of humankind.",
      sellerPhone: "254722100001",
    },
    {
      title: "Dune",
      author: "Frank Herbert",
      isbn: "9780441013593",
      condition: "Good",
      price: 270,
      description:
        "Hardcover, clean pages, slight cover fading. Epic science fiction adventure.",
      sellerPhone: "254722100002",
    },
    {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      isbn: "9780743273565",
      condition: "Like New",
      price: 210,
      description:
        "Beautiful edition, pristine condition. Jazz Age romance and intrigue.",
      sellerPhone: "254722100001",
    },
    {
      title: "Pride and Prejudice",
      author: "Jane Austen",
      isbn: "9780141439518",
      condition: "Good",
      price: 160,
      description:
        "Penguin Classics edition. Some gentle wear, excellent readability.",
      sellerPhone: "254722100003",
    },
    {
      title: "The Lord of the Rings",
      author: "J.R.R. Tolkien",
      isbn: "9780544003415",
      condition: "Fair",
      price: 350,
      description:
        "Complete trilogy in one volume. Heavy use, binding intact but worn.",
      sellerPhone: "254722100002",
    },
  ];

  listings.forEach((listing) => {
    const listingRecord = {
      id: uuid(),
      ...listing,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      active: true,
      soldAt: null,
      openLibraryData: {},
      enrichedAt: null,
    };
    db.books.set(listingRecord.id, listingRecord);
    console.log(`  ✓ ${listing.title} by ${listing.author} (${listing.price} KES)`);
  });

  console.log(`✅ Seeded ${listings.length} listings\n`);

  // ==================== ORDERS ====================
  console.log("📦 Seeding orders...");

  // Get listing IDs for reference
  const listingIds = Array.from(db.books.keys());

  const orders = [
    {
      bookId: listingIds[0],
      buyerPhone: "254722101001",
      sellerPhone: "254722100001",
      status: "COMPLETED",
      amount: 250,
      quantity: 1,
      dispatchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      confirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
    {
      bookId: listingIds[1],
      buyerPhone: "254722101002",
      sellerPhone: "254722100002",
      status: "IN_TRANSIT",
      amount: 180,
      quantity: 1,
      dispatchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      deliveredAt: null,
    },
    {
      bookId: listingIds[2],
      buyerPhone: "254722101001",
      sellerPhone: "254722100003",
      status: "PENDING_DISPATCH",
      amount: 120,
      quantity: 1,
      dispatchedAt: null,
    },
    {
      bookId: listingIds[3],
      buyerPhone: "254722101003",
      sellerPhone: "254722100001",
      status: "PENDING_PAYMENT",
      amount: 400,
      quantity: 1,
      dispatchedAt: null,
    },
    {
      bookId: listingIds[4],
      buyerPhone: "254722101002",
      sellerPhone: "254722100002",
      status: "DELIVERED",
      amount: 270,
      quantity: 1,
      dispatchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  orders.forEach((order, idx) => {
    const orderRecord = {
      id: uuid(),
      ...order,
      createdAt: new Date(Date.now() - (10 - idx) * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: null,
      disputedAt: null,
    };
    db.orders.set(orderRecord.id, orderRecord);
    console.log(`  ✓ Order ${idx + 1}: ${order.status} (${order.amount} KES)`);
  });

  console.log(`✅ Seeded ${orders.length} orders\n`);

  // ==================== TRANSACTIONS ====================
  console.log("💳 Seeding transactions...");

  const transactionIds = [];
  Array.from(db.orders.entries()).forEach((entry, idx) => {
    const orderId = entry[0];
    const order = entry[1];

    if (
      order.status === "COMPLETED" ||
      order.status === "IN_TRANSIT" ||
      order.status === "DELIVERED"
    ) {
      const txId = uuid();
      const transaction = {
        id: txId,
        orderId,
        phone: order.buyerPhone,
        amount: order.amount,
        status: "SUCCESS",
        paymentProvider: "daraja",
        checkoutRequestId: `ws_CO_${Date.now()}_${idx}`,
        callbackEventId: `evt_${Date.now()}_${idx}`,
        mpesaReceiptNumber: `LHD${Math.random().toString().slice(2, 8).toUpperCase()}`,
        reconciliationStatus: "RECONCILED",
        createdAt: new Date(order.createdAt).toISOString(),
        callbackReceivedAt: new Date(Date.parse(order.createdAt) + 60000).toISOString(),
        reconciliedAt: new Date(Date.parse(order.createdAt) + 120000).toISOString(),
        metadata: {},
      };
      db.transactions.set(txId, transaction);
      transactionIds.push(txId);
      console.log(`  ✓ Transaction for ${order.amount} KES`);
    }
  });

  console.log(`✅ Seeded ${transactionIds.length} transactions\n`);

  // ==================== LEDGER ====================
  console.log("📊 Seeding ledger entries...");

  let ledgerCount = 0;

  // Create ledger entries for successful orders
  Array.from(db.orders.entries()).forEach((entry) => {
    const order = entry[1];

    if (
      ["COMPLETED", "IN_TRANSIT", "DELIVERED"].includes(order.status) &&
      order.amount > 0
    ) {
      // Platform fees: 6% delivery + (future) 2.5% commission
      const deliveryFee = Math.round(order.amount * 0.06);
      const sellerNetAmount = order.amount - deliveryFee;

      // Entry 1: Payment received
      db.ledger.push({
        id: uuid(),
        orderId: order.id,
        entryType: "PAYMENT_RECEIVED",
        fromAccount: "buyer",
        toAccount: "escrow",
        amount: order.amount,
        reason: "Buyer paid for book",
        createdAt: order.createdAt,
        metadata: { transactionId: transactionIds[0] },
      });
      ledgerCount++;

      // Entry 2: Delivery fee held
      db.ledger.push({
        id: uuid(),
        orderId: order.id,
        entryType: "DELIVERY_FEE_HELD",
        fromAccount: "escrow",
        toAccount: "platform",
        amount: deliveryFee,
        reason: `Delivery fee held (${Math.round(6)}%)`,
        createdAt: order.createdAt,
      });
      ledgerCount++;

      // Entry 3: Funds released to seller (on confirmation or auto-release)
      if (
        order.status === "COMPLETED" ||
        order.status === "DELIVERED"
      ) {
        db.ledger.push({
          id: uuid(),
          orderId: order.id,
          entryType: "FUNDS_RELEASED",
          fromAccount: "escrow",
          toAccount: "seller",
          amount: sellerNetAmount,
          reason:
            order.status === "COMPLETED"
              ? "Released to seller on buyer confirmation"
              : "Released to seller (delivery completed)",
          createdAt: order.confirmedAt || order.deliveredAt,
        });
        ledgerCount++;
      }
    }
  });

  console.log(`✅ Seeded ${ledgerCount} ledger entries\n`);

  // ==================== AUDIT LOG ====================
  console.log("🔐 Seeding audit log...");

  db.auditLog = [
    {
      id: uuid(),
      eventType: "DATABASE_SEEDED",
      data: {
        timestamp: nowIso(),
        users: sellers.length + buyers.length,
        listings: listings.length,
        orders: orders.length,
      },
      timestamp: nowIso(),
    },
  ];

  console.log("✅ Audit log initialized\n");

  // ==================== SUMMARY ====================
  console.log("════════════════════════════════════════");
  console.log("✨ DATABASE SEED COMPLETE ✨");
  console.log("════════════════════════════════════════\n");

  console.log("📊 Seed Summary:");
  console.log(`  • Users: ${db.users.size} (${sellers.length} sellers, ${buyers.length} buyers)`);
  console.log(`  • Listings: ${db.books.size}`);
  console.log(`  • Orders: ${db.orders.size}`);
  console.log(`  • Transactions: ${db.transactions.size}`);
  console.log(`  • Ledger entries: ${db.ledger.length}`);
  console.log("");

  console.log("🧪 Test Data Available:");
  console.log("  Seller: 254722100001 (Alice - verified)");
  console.log("  Seller: 254722100002 (Bob - unverified)");
  console.log("  Buyer: 254722101001 (David)");
  console.log("  Buyer: 254722101002 (Eva)");
  console.log("");

  console.log("🚀 Next Steps:");
  console.log("  1. npm start          # Start the dev server");
  console.log("  2. GET /api/listings  # Browse books");
  console.log("  3. POST /api/auth/signup  # Create new user");
  console.log("");
}

// Run seed
try {
  seedDatabase();
  process.exit(0);
} catch (error) {
  console.error("❌ Seed failed:", error);
  process.exit(1);
}
