const { randomUUID } = require("crypto");

const nowIso = () => new Date().toISOString();

const db = {
  users: new Map(),
  books: new Map(),
  orders: new Map(),
  transactions: new Map(),
  paymentInitiationKeys: new Map(),
  callbackEvents: new Map(),
  ledger: [],
  disputes: new Map(),
  pickupPoints: [
    { id: "pickup-nairobi-cbd", name: "Nairobi CBD Pickup", county: "Nairobi" },
    { id: "pickup-kisumu-town", name: "Kisumu Town Pickup", county: "Kisumu" },
  ],
};

function createPhoneUser(phone) {
  let user = db.users.get(phone);
  if (!user) {
    user = {
      id: randomUUID(),
      phone,
      booksSoldCount: 0,
      createdAt: nowIso(),
    };
    db.users.set(phone, user);
  }
  return user;
}

function appendLedgerEntry(entry) {
  db.ledger.push({ id: randomUUID(), createdAt: nowIso(), ...entry });
}

module.exports = {
  db,
  nowIso,
  createPhoneUser,
  appendLedgerEntry,
};
