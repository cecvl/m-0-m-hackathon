# Backend Prototype (Today)

Quick MVP backend for the Kenya 2nd-hand book marketplace.

## Run

```bash
npm install
npm run dev
```

Server starts on `http://localhost:4000` by default.

## Demo Seed (One Command)

Start the server first, then run:

```bash
npm run demo:seed
```

Optional custom URL:

```bash
BASE_URL=http://localhost:4000 npm run demo:seed
```

## Prototype Endpoints

- `GET /health`
- `POST /api/listings`
- `GET /api/listings?q=alchemist`
- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/payments/stk/initiate`
- `POST /api/payments/stk/callback`
- `POST /api/orders/:id/dispatch`
- `POST /api/orders/:id/delivered`
- `POST /api/orders/:id/confirm`
- `GET /api/admin/state`
- `GET /api/admin/reconciliation`
- `POST /api/admin/escrow/auto-release`

## Notes

- Data is in-memory only for demo speed.
- M-Pesa integration is mocked via initiate/callback endpoints.
- Escrow is represented as platform-held funds in a ledger.

## Phase 2 Started

- Callback idempotency via `callbackEventId` (duplicate callbacks ignored).
- Optional callback signature validation with `x-callback-signature`.
- Reconciliation status tracking on transactions and admin report endpoint.

## Signup Alerts (Do This Now)

- `Safaricom Daraja (Sandbox)`: required for real STK push and callback testing.
- `Africa's Talking (Sandbox/Prod)`: required for SMS notifications to buyers/sellers.
- `MongoDB Atlas`: needed when moving from in-memory data to persistent Phase 1 DB.
- `Render` or `Railway`: backend hosting target for shared demo/staging URL.
- `Vercel`: frontend hosting (since frontend is separate).
- `ngrok` or `Cloudflare Tunnel`: required for testing callbacks against local machine.

Minimum credentials to collect today:

- Consumer key + secret (Daraja)
- Passkey + shortcode/till (Daraja)
- SMS API key + username (Africa's Talking)
- MongoDB connection string (Atlas)
