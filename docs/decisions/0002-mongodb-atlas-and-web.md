# ADR 0002: MongoDB Atlas storage and a password-protected website

- Status: Accepted
- Date: 2026-09-30

## Context

The owner wants to use Dinary from a website as well as the phone. Data only on the phone (Expo SQLite) cannot be shared, so the owner asked to store it in MongoDB Atlas. The app still serves one person. The website is hosted on Vercel and must ask for a password.

## Decision

- **Storage:** MongoDB Atlas is the source of truth. Collections mirror the old tables: `accounts`, `transactions`, `recurring_rules`, `category_budgets`, `custom_categories`, plus `login_attempts`. Documents keep the old text IDs as `_id`.
- **No database access from the client.** The MongoDB driver runs only in Expo Router API routes (`src/app/api/**/+api.ts`, logic in `src/server/`). The phone and the website both call this API. Atlas credentials stay on the server (Vercel environment variables).
- **Hosting:** `web.output` is `server`. Vercel serves `dist/client` as static files and runs `api/index.js` (the `expo-server` Vercel adapter) for API routes and pages.
- **Money:** amounts are validated as safe integers and stored as BSON Int64 millimes. The server, not the client, creates IDs, titles and timestamps, checks accounts and categories, and takes the salary amount from the stored rule when confirming it.
- **Password:** one owner password (`DINARY_PASSWORD`). Login returns an HMAC-signed session token (`DINARY_SESSION_SECRET`):
  - website: HttpOnly, `SameSite=Strict`, `Secure` cookie for 30 days, plus an `Origin` check on writes;
  - phone: the same token in the response body, kept in `expo-secure-store` for 365 days and sent as a Bearer token.
  - Failed logins are counted in MongoDB (TTL 15 min): 10 per IP or 50 in total blocks login for 15 minutes.
  - The phone also asks for the password once. The API is public on the internet, so the phone needs a credential too; shipping a fixed secret inside the app would let anyone who gets the APK read the data.
- **Old data:** the SQLite file on the phone is kept and only read. The Backup screen offers:
  - "Old backup": copy the phone's SQLite data to MongoDB, or save it as a version 1 JSON file;
  - "New backup": download a version 2 JSON file from MongoDB (includes voided transactions);
  - on the website: import either file.
  Import rule per record: add when missing, replace only when the imported `updatedAt` is newer, otherwise skip. It runs in one MongoDB transaction after validating every record, so it is all-or-nothing and safe to repeat. Seeded default accounts use `updatedAt = 1970-01-01`, so the phone's opening balances win on first import.

## Consequences

- The app now needs the internet to load and save data. There is no offline mode or offline write queue yet; this goes against the "works offline" goal in the product spec until a local cache is added.
- Deleted transactions stay in MongoDB with `status: "voided"`, like before. Imports never delete cloud records.
- Vercel limits request bodies to 4.5 MB, which limits the size of one backup import (roughly 10,000+ transactions).
- Changing `DINARY_SESSION_SECRET` signs out every browser and phone. There is no per-device revoke.
- If a custom category with the same name is created on the website before importing old phone data, both copies will exist (different IDs).
- `scripts/api-smoke-test.mjs` checks the API end to end against a disposable `*_test` database.
