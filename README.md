# Backend Prototype (Today)

Quick MVP backend for the Kenya 2nd-hand book marketplace.

For implementation status and completed work, see `implementations.md`.

## Run

```bash
npm install
npm run dev
```

Server starts on `http://localhost:4000` by default.

## Roles (Phase 3 Abstraction)

Role context can be passed with headers:

- `x-user-role`: `buyer` | `seller` | `admin`
- `x-user-phone`: actor phone number

Important:

- By default (`REQUIRE_ROLE_ENFORCEMENT=false`), missing role headers are allowed for backward compatibility.
- Set `REQUIRE_ROLE_ENFORCEMENT=true` in `.env` to enforce role checks strictly.

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

## Seed Listings To MongoDB (BookMonkey Source)

Run BookMonkey API separately, then import listings into MongoDB:

```bash
npm run demo:bookmonkey:api
npm run seed:listings
```

This imports books from `BOOKMONKEY_BASE_URL/books` into `bookmarket.listings` with source=`bookmonkey`.

## Daraja Sandbox STK Testing

1. Set values in `.env`:
2. Expose localhost (e.g. ngrok) so Daraja can hit your callback URL.
3. Start backend and initiate STK push via `POST /api/payments/stk/initiate`.



## External Catalog Provider

Use an external API as catalog source (no dummy catalog in project runtime):

```bash
BOOK_DATA_PROVIDER=bookmonkey npm start
```

Optional base URL override:

```bash
BOOKMONKEY_BASE_URL=http://localhost:4730 npm run demo:bookmonkey:check
```
