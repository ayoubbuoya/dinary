# Dinary contributor instructions

## Source of truth

- Read `docs/frontend-foundation.md` before frontend work and `docs/product-spec.md` before work that touches product behavior, data, privacy, voice, AI, sync, or financial calculations.
- The current implementation phase is a **single-owner cloud app** (see `docs/decisions/0002-mongodb-atlas-and-web.md`): product data lives in MongoDB Atlas behind the Dinary API (Expo Router API routes deployed on Vercel), shared by the phone app and the website. Do not add multi-user accounts, third-party auth, other cloud databases, real voice recording/transcription, or AI-model execution unless the task explicitly moves the project beyond this phase.
- Preserve the existing Expo project. Do not re-initialize it or move Expo Router routes solely to match a suggested directory tree.

## Expo SDK 57

- This app uses Expo SDK 57. Before writing Expo or React Native code, consult the exact versioned docs: <https://docs.expo.dev/versions/v57.0.0/>.
- Keep Expo's supported runtime versions aligned with SDK 57: React Native `0.86`, React `19.2.3`, React Native Web `0.21.0`, and Node.js `22.13.x` or newer.
- Install Expo-compatible native packages with `npx expo install <package>` rather than pinning versions manually. Use the repository's existing package manager; do not switch package managers.
- Use Expo Router for navigation and preserve `main: "expo-router/entry"`. Verify configuration changes against the SDK 57 `app.json` and Expo Router documentation.
- Prefer Expo modules and development builds for functionality that needs native capabilities. Never assume Expo Go supports a native module or device API without checking the SDK 57 documentation.

## Frontend foundation conventions

- Use TypeScript, Expo Router, NativeWind/shared design tokens, and small reusable components. Keep route files, reusable UI, finance components, constants, utilities, and types clearly separated.
- Product name: `Dinary`; repository slug: `dinary`; assistant name: `Hsebli`; currency: `TND`; default locale: Tunisia.
- Implement light mode only for now, while keeping tokens extensible for future dark mode. Follow the palette and component guidance in `docs/frontend-foundation.md`.
- Build the screens and routes required by the brief: home (`/`), transactions (`/transactions`), add transaction (`/add-transaction`), salary (`/salary`), and assistant (`/assistant`). Voice and assistant controls are static placeholders in this phase.
- Prioritize accessibility: labelled inputs, readable contrast, comfortable touch targets, visible pressed/disabled states, clear empty states, and signs as well as color for income/expense amounts.

## Financial-domain invariants

- Treat financial data as sensitive. Accuracy and privacy take precedence whenever requirements conflict.
- Store real monetary values as integer millimes—never floating point. One TND equals 1,000 millimes. Display TND with three decimal places (for example, `20.500 TND`) unless an explicitly approved display rule says otherwise.
- A balance is opening balance plus confirmed income minus confirmed expenses; linked transfers affect account balances but never income/expense analytics.
- Use the device timezone when assigning transactions to reporting months. Expected recurring income affects forecasts only; it must not affect actual balance until confirmed.
- Any future voice or assistant-created transaction must be a reviewable draft. Missing amount/type or low-confidence fields block confirmation; AI must never directly mutate financial records.

## Data, privacy, and security work

- MongoDB Atlas is the operational source of truth. Only server code in `src/server/` and `src/app/api/**/+api.ts` may talk to MongoDB. Never import `src/server/` from screens or components, and never expose `MONGODB_URI`, `DINARY_PASSWORD`, or `DINARY_SESSION_SECRET` with an `EXPO_PUBLIC_` prefix.
- Every API route except login/logout must call `requireSession` (use `withSession`). The website uses the HttpOnly session cookie; the phone stores its token only in `expo-secure-store`.
- The server validates every write and decides IDs, titles, and timestamps. Store money in MongoDB as BSON 64-bit integers of millimes (`toMillimes`), never doubles.
- The old on-device SQLite database (`src/features/legacy/`) is read-only legacy data used for "Old backup" export and the one-time copy to MongoDB. Do not write to it or delete it.
- Export and backup files are user-initiated: on the phone they go through the operating-system share sheet, on the website through a normal browser download.
- If multi-user support is ever added, every document needs an owner ID derived from the verified session, never from the request body.
- Store sessions in secure device storage, request microphone permission only after the user starts voice entry, and do not upload raw audio or transcripts by default.
- Keep AI grounded in typed, bounded, read-only analytics facts. Calculations belong in code/queries; the model may explain them but must not invent figures or provide regulated financial advice.
- Add automated tests when changing balance calculations, recurring-rule dates, API routes, backup import rules, or authentication. Extend `scripts/api-smoke-test.mjs` (`npm run test:api`, against a disposable `*_test` database) for API changes. Record material technical decisions as short ADRs under `docs/decisions/`.

## Verification

- Inspect existing package versions before adding dependencies, and install only what the task needs.
- Run the relevant checks after changes. At minimum, use `npm run lint` when the change affects application code or configuration, and report any pre-existing failures separately.

## Rules

- After each chnage in code, suggest a full detailled professional github commit message for those chnage. Do not commit it yourself, just suggest it. The commit message should be in the following format:`<type>(<scope>): <subject>`. Do not add couthors to the commit.
