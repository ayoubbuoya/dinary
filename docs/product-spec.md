# Wallet TND — Product & Technical Specification

**Status:** Draft v0.1  
**Audience:** Product, mobile, backend, AI, and QA contributors  
**Primary market:** Tunisia  
**Primary platform:** iOS and Android using Expo / React Native

## 1. Product summary

Wallet TND is a private, local-first mobile application that helps a person in Tunisia understand and manage their money in Tunisian dinars (TND).

The initial user is the product owner. The application must therefore prioritize useful personal money management over features intended for a broad public launch. A user records income and expenses manually or by voice, sees where their money goes, manages recurring salary and bills, and receives clear, privacy-preserving insights.

The app is **not** a bank account, a payment application, an investment platform, or a source of regulated financial advice. It tracks user-entered information only.

## 2. Product goals

1. Make recording an expense take less than 15 seconds.
2. Make monthly spending, remaining money, and upcoming salary easy to understand.
3. Support Tunisian habits: TND, cash, local card/e-wallet accounts, and Arabic/French/English or mixed-language notes.
4. Work without an internet connection; synchronize safely when a connection is available.
5. Keep personal financial data private. Cloud storage is for authenticated backup and sync, never a requirement for day-to-day usage.
6. Provide useful automated insights without pretending that an AI model is an accountant or financial adviser.

## 3. Non-goals for the first release

- Connecting to Tunisian banks, cards, SMS messages, or payment providers.
- Moving money, making payments, or holding funds.
- Shared family accounts, expense splitting, or multi-currency accounting.
- OCR receipt scanning.
- A fully autonomous AI that can change, delete, or create financial records without user confirmation.
- Investment, credit, tax, legal, or debt advice.

## 4. Target user and core jobs

### Primary user

A Tunisian person who receives a recurring monthly salary, pays mostly with cash or local payment methods, and wants clarity about their spending.

### Jobs to be done

- “I just paid for something; let me record it before I forget.”
- “Tell me what I spent this month and where the money went.”
- “My salary arrives on the third; can I safely spend this amount before then?”
- “I want to tell the app in Tunisian Arabic/English what I bought instead of filling a form.”
- “Show me patterns that I would not notice myself.”

## 5. Core user experience

### 5.1 Home dashboard

Show the following for the active month:

- Current available balance across selected accounts.
- Income received and expenses paid.
- Remaining amount against the monthly plan/budget.
- Largest spending categories.
- Next expected income or recurring bill.
- One short insight, if enough data exists.

### 5.2 Add transaction manually

The user can create an income, expense, or transfer by entering:

- Amount in TND.
- Type: income, expense, or transfer.
- Date and time (defaults to now).
- Account.
- Category.
- Optional note.

Amounts must be stored as integer **millimes**, never floating-point values. Example: `20.500 TND` is stored as `20500` millimes.

### 5.3 Voice transaction capture

The voice flow is deliberately a two-step flow:

1. The app records/transcribes the user’s speech.
2. A parser produces a **draft** transaction. The user reviews and confirms it before the transaction is saved.

Example input:

> “Sraft 20 dinar ala mlawi lel family.”

Expected draft:

| Field | Value |
| --- | --- |
| Amount | 20.000 TND |
| Type | Expense |
| Category | Food / eating out |
| Note | Mlawi for the family |
| Date | Today |
| Confidence | High |

If the amount, type, date, or account is uncertain, the UI must ask a short question or leave the field visibly incomplete. It must never guess and automatically commit a low-confidence financial record.

### 5.4 Salary and recurring transactions

The user can define recurring rules, initially focused on salary:

- Amount or variable amount.
- Frequency (monthly in v1).
- Expected day of month.
- Description and account.
- Whether the expected payment has been received.

Example: “My salary for the previous month arrives on day 3.” The app should show it as an expected income on the next valid day 3. It becomes real balance only when the user confirms it as received.

### 5.5 Analytics

The app calculates, not an AI model:

- Spending by category, day, week, and month.
- Income versus expenses.
- Current balance by account and total balance.
- Budget usage and remaining budget.
- Spending compared with previous complete months.
- Forecasted balance using confirmed transactions and recurring rules.

### 5.6 Personal assistant

The assistant answers questions using pre-computed, exact financial facts from the local database.

Example questions:

- “How much did I spend on food this month?”
- “Why is this month more expensive than last month?”
- “Can I spend 100 TND before salary day?”
- “What are my three biggest expense categories?”

The assistant may explain trends, suggest a budgeting target, and point to relevant transactions. It must clearly distinguish observed facts from suggestions. It must not claim certainty about future cash flow, provide investment advice, or invent figures.

## 6. Scope by phase

### Phase 1 — Useful personal wallet

- Local account and transaction management.
- TND formatting and integer-millime accounting.
- Categories and transaction search/filtering.
- Monthly dashboard and charts.
- Salary/recurring-income rule.
- Supabase authentication and backup/sync.

### Phase 2 — Fast capture

- Voice transcription.
- Mixed Arabic/English/French transaction parser.
- Draft review and correction screen.
- Learning from user category corrections.

### Phase 3 — Local assistant

- On-device small language model (SLM).
- Structured tool calls to retrieve calculated analytics.
- Conversational explanations and budget suggestions.
- Optional spoken answers.

### Phase 4 — Only after real use validates it

- Custom categories and monthly budgets.
- Export to CSV/PDF.
- Receipt attachments.
- Shared household mode.
- Bank/SMS import, if legal, technically reliable, and explicitly wanted.

## 7. Technical architecture

### 7.1 Stack

| Area | Decision | Reason |
| --- | --- | --- |
| Mobile | Expo + React Native + TypeScript | One codebase for iOS and Android. |
| Local data | SQLite, with encrypted device storage where supported | Fast offline queries and an offline-first experience. |
| Cloud sync | Supabase: PostgreSQL, Auth, Row Level Security | Relational finance data, robust analytics queries, and simple authenticated backup. |
| State/query layer | A typed repository layer plus a query/cache library | Keeps UI independent from storage/sync details. |
| Voice | Native speech recognition through an Expo development build | Can use device recognition where available; behavior varies by OS and language packs. |
| On-device AI | Quantized GGUF SLM via a React Native native module | Keeps assistant requests private and avoids per-request model costs. |

### 7.2 Why Supabase, not MongoDB

Use Supabase/PostgreSQL for the cloud source of truth. Finance is relational: transactions belong to accounts, categories, and users; recurring rules create forecasts; analytics require grouping by period and category. PostgreSQL supports this naturally and Supabase provides Auth and Row Level Security (RLS).

MongoDB would work, but it adds no advantage for this transaction-first product and makes reporting/relational constraints less natural.

### 7.3 Local-first and sync model

The local database is the app’s operational source of truth. The remote database is the user’s synchronized backup and multi-device copy.

1. Every create/update/delete is saved locally first.
2. The operation is queued for sync.
3. When authenticated and online, the queue synchronizes to Supabase.
4. Remote changes are pulled and applied locally.
5. Sync state is visible but should not block normal use.

Each mutable record needs: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (nullable tombstone), and `sync_version` or equivalent conflict metadata.

For the initial single-user application, use last-write-wins only for low-risk profile/category metadata. For financial transactions, a conflicting edit must create a visible conflict for the user to resolve; never silently discard a transaction edit.

## 8. Data model

All user-owned tables must include `user_id`. Every cloud table exposed to the client must use RLS policies limiting access to `auth.uid() = user_id`.

### 8.1 `accounts`

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | Owner |
| name | text | e.g. Cash, BIAT card, e-Dinar |
| type | enum | cash, bank_card, bank_account, e_wallet, other |
| opening_balance_millimes | bigint | Optional initial amount |
| is_archived | boolean | Defaults false |

### 8.2 `categories`

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID nullable | Null means system category |
| name | text | e.g. Food, Transport |
| kind | enum | income or expense |
| parent_id | UUID nullable | Optional hierarchy |
| icon | text | UI identifier |
| color | text | UI token/hex |

Initial expense categories: Food, Groceries, Transport, Bills, Family, Health, Education, Entertainment, Shopping, Subscriptions, Other.

### 8.3 `transactions`

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | Owner |
| account_id | UUID | Account affected |
| category_id | UUID nullable | Required for income/expense after confirmation |
| type | enum | income, expense, transfer |
| amount_millimes | bigint | Positive integer only |
| occurred_at | timestamp with time zone | Financial date/time |
| note | text nullable | User-owned text |
| source | enum | manual, voice, recurring, import |
| transfer_group_id | UUID nullable | Links two sides of a transfer |
| status | enum | confirmed, voided |

Transfers are represented as two linked transaction records: a negative effect from one account and a positive effect in another. They must not count as income or expense in spending analytics.

### 8.4 `recurring_rules`

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | Owner |
| type | enum | income or expense |
| amount_millimes | bigint nullable | Null allowed for variable salary |
| category_id | UUID nullable | Category for created transaction |
| account_id | UUID | Expected account |
| frequency | enum | monthly in v1 |
| day_of_month | smallint | 1–31; handle short months explicitly |
| description | text | e.g. Monthly salary |
| is_active | boolean | Defaults true |

### 8.5 `transaction_drafts`

Drafts are local by default. Store transcript, parsed fields, field confidence, parser version, and creation time. Delete drafts after confirmation or expiry unless the user chooses to retain them.

### 8.6 `budgets` (Phase 4)

Monthly limits by category or overall spending. Budgets are optional and should never make an account balance appear incorrect.

## 9. Voice and language design

### 9.1 Supported language expectation

The application must accept natural short statements containing Tunisian Arabic (Darija), Arabic, French, English, and code-switching. Exact speech-recognition quality is device-dependent; users must always be able to edit the transcript and the parsed draft.

### 9.2 Parsing strategy

Do not give free-form speech directly to an SLM and trust the result. Use a layered parser:

1. Speech recognizer returns transcript and language metadata if available.
2. Deterministic rules detect numbers, currency words (`dinar`, `dinars`, `dt`, `TND`, `millime`), expense/income verbs, and dates.
3. A local model, if available, maps the remaining meaning to a strict JSON schema.
4. Validation checks the JSON and applies app rules.
5. The UI displays the resulting draft for confirmation.

Example structured result:

```json
{
  "type": "expense",
  "amountMillimes": 20000,
  "currency": "TND",
  "occurredAt": "2026-07-10",
  "categoryHint": "food",
  "note": "mlawi for the family",
  "confidence": {
    "amount": "high",
    "type": "high",
    "category": "medium"
  }
}
```

The parser must reject invalid output rather than attempting to repair unknown values silently.

## 10. On-device assistant design

### 10.1 Principle: code calculates, model communicates

The app’s code and SQL queries calculate balances, totals, comparisons, and forecasts. The SLM receives a limited, structured facts packet and explains it in natural language.

The model must never write directly to the database. If the user says “add a 20 TND food expense,” the assistant opens the same reviewable transaction draft flow used by voice capture.

### 10.2 Assistant tools

The assistant may call local read-only functions such as:

- `get_spending_by_category(period)`
- `get_month_summary(month)`
- `compare_months(current, previous)`
- `get_upcoming_recurring_transactions(days)`
- `get_safe_to_spend_until(date)`
- `search_transactions(filters)`

Each tool must return a typed, bounded result. Do not place the full transaction history into the model context by default.

### 10.3 Model requirements

- Fully local inference after model download.
- Quantized model suitable for modern phones.
- JSON-schema/grammar constrained output for parsing and tool calls.
- Graceful fallback: if unavailable, all wallet features still work and the app shows standard non-AI analytics.
- Device capability check before download, with clear size and storage information.

## 11. Security and privacy requirements

1. Never ship Supabase service-role keys in the mobile app.
2. Enable and test RLS for every user-owned remote table.
3. Use authenticated user IDs in every policy; do not trust a `user_id` supplied by the app alone.
4. Store auth/session tokens in secure device storage, not plain application storage.
5. Encrypt sensitive local data at rest when the selected mobile database solution supports it; document platform limitations honestly.
6. Request microphone permission only when the user starts voice entry.
7. Explain whether voice recognition is on-device or sent to the platform provider on the current device. Do not claim “offline/private” when the OS is using network recognition.
8. Do not upload raw audio by default. Do not upload transcripts to cloud AI services.
9. Support account deletion and export in a later public-release phase before onboarding other users.
10. Treat transaction notes and assistant conversations as sensitive personal data.

## 12. Quality requirements and acceptance criteria

### Correctness

- A displayed balance equals opening balance plus confirmed incomes minus confirmed expenses, accounting for transfers correctly.
- TND values round/display to three decimal places and use integer millimes internally.
- Transactions dated in the current device timezone appear in the correct reporting month.
- A recurring salary forecast does not change the actual balance before confirmation.
- Deleting a transaction updates relevant analytics locally before sync completes.

### Voice safety

- A voice-created transaction is never persisted as confirmed without a user action.
- Missing amount or type blocks confirmation.
- Confidence and parser uncertainty are visible when relevant.

### Offline behavior

- Manual transaction creation, editing, dashboard reading, and analytics work with no connection after initial setup.
- The app shows unsynced changes and retries sync safely.

### Performance

- Home dashboard opens from local data without waiting for network.
- Transaction save provides immediate visual confirmation.
- AI inference must be cancellable and must not block interaction with normal wallet screens.

## 13. Suggested repository structure

```text
apps/mobile/                 Expo application
  src/features/accounts/
  src/features/transactions/
  src/features/recurring-rules/
  src/features/analytics/
  src/features/voice-capture/
  src/features/assistant/
  src/data/local/            SQLite schema and repositories
  src/data/sync/             Outbox and Supabase synchronization
  src/domain/                Money, dates, forecasts, validation
supabase/
  migrations/
  tests/                     RLS and database tests
docs/
  product-spec.md            This document
  decisions/                 Architecture decision records
```

## 14. Delivery plan

### Milestone A: Foundation

- Expo app scaffold, navigation, design tokens, and local database.
- Domain tests for money arithmetic, dates, and account balances.
- Accounts, categories, and manual transactions.

### Milestone B: Personal finance core

- Dashboard, monthly reports, filtering, and salary recurring rule.
- Supabase schema, Auth, RLS policies, and local-to-cloud sync.
- Offline and conflict behavior tests.

### Milestone C: Voice capture

- Native speech recognition in an Expo development build.
- Deterministic parsing, strict JSON validation, draft review UI.
- Test corpus of real Tunisian Arabic/French/English mixed examples.

### Milestone D: Local assistant

- Device capability checks and optional SLM download.
- Read-only analytics tools and grounded-answer evaluation tests.
- Explicit fallback experience when local AI is unavailable.

## 15. Team rules

- Prefer the smallest feature that proves real value for the first user.
- Do not add a cloud AI API as a shortcut for the assistant without an explicit product/privacy decision.
- Do not allow the AI to mutate money data without a confirmation screen.
- Add automated tests whenever modifying balance calculation, recurring-rule dates, synchronization, or RLS policies.
- Document material technical choices in `docs/decisions/` using short Architecture Decision Records (ADRs).
- If a requirement conflicts with accurate balances or data privacy, accurate balances and privacy win.

## 16. Open decisions

These must be confirmed before implementation of the affected phase:

1. Minimum supported Android version and target device RAM/storage profile.
2. Whether the first account setup requires login or supports entirely local/anonymous use before optional backup.
3. The preferred initial language of the UI: English, French, Arabic, or multilingual.
4. The list of accounts/payment methods to show by default.
5. The exact local SLM and model download/distribution approach after device testing.
6. Whether cloud backup will include assistant chat history, or keep it device-only.
