# Backend Prototype (Today)

Quick MVP backend for the Kenya 2nd-hand book marketplace.

For implementation status and completed work, see `implementations.md`.

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

## DB Check

```bash
npm run db:check
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
