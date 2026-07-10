# Dinary contributor instructions

## Source of truth

- Read `docs/frontend-foundation.md` before frontend work and `docs/product-spec.md` before work that touches product behavior, data, privacy, voice, AI, sync, or financial calculations.
- The current implementation phase is the **frontend foundation**: build a polished static app shell with mock data only. Do not add Supabase, authentication, persistence, sync, real voice recording/transcription, or AI-model execution unless the task explicitly moves the project beyond this phase.
- Preserve the existing Expo project. Do not re-initialize it or move Expo Router routes solely to match a suggested directory tree.

## Expo SDK 57

- This app uses Expo SDK 57. Before writing Expo or React Native code, consult the exact versioned docs: <https://docs.expo.dev/versions/v57.0.0/>.
- Keep Expo's supported runtime versions aligned with SDK 57: React Native `0.86`, React `19.2.3`, React Native Web `0.21.0`, and Node.js `22.13.x` or newer.
- Install Expo-compatible native packages with `npx expo install <package>` rather than pinning versions manually. Use the repository's existing package manager; do not switch package managers.
- Use Expo Router for navigation and preserve `main: "expo-router/entry"`. Verify configuration changes against the SDK 57 `app.json` and Expo Router documentation.
- Prefer Expo modules and development builds for functionality that needs native capabilities. Never assume Expo Go supports a native module or device API without checking the SDK 57 documentation.

## Frontend foundation conventions

- Use TypeScript, Expo Router, NativeWind/shared design tokens, and small reusable components. Keep route files, reusable UI, finance components, constants/mock data, utilities, and types clearly separated.
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

## Future data, privacy, and security work

- The local database is the operational source of truth; cloud sync is authenticated backup/multi-device synchronization and must not block normal offline use.
- Never ship a Supabase service-role key. Every client-exposed user-owned cloud table requires Row Level Security based on `auth.uid() = user_id`; do not trust an app-supplied user ID alone.
- Store sessions in secure device storage, request microphone permission only after the user starts voice entry, and do not upload raw audio or transcripts by default.
- Keep AI grounded in typed, bounded, read-only analytics facts. Calculations belong in code/queries; the model may explain them but must not invent figures or provide regulated financial advice.
- Add automated tests when changing balance calculations, recurring-rule dates, synchronization, or RLS policies. Record material technical decisions as short ADRs under `docs/decisions/`.

## Verification

- Inspect existing package versions before adding dependencies, and install only what the task needs.
- Run the relevant checks after changes. At minimum, use `npm run lint` when the change affects application code or configuration, and report any pre-existing failures separately.

## Rules

- After each chnage in code, suggest a full detailled professional github commit message for those chnage. Do not commit it yourself, just suggest it. The commit message should be in the following format:`<type>(<scope>): <subject>`. Do not add couthors to the commit.
