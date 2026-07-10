# Dinary Frontend Foundation Implementation Brief

This document tells the AI agent or development team what to build first for the Dinary mobile app frontend.

Dinary is an Expo React Native application for managing Tunisian Dinar money, manually or by voice later. The Expo project is already initialized and uses Expo SDK 57. Do not re-initialize the app. Work inside the existing project.

## Goal of this phase

Build the frontend foundation for Dinary before connecting the database, authentication, voice parsing, or local AI assistant.

The output of this phase should be a polished static app shell using mock data. It should feel like a real finance app, but all data can be hardcoded for now.

## Non-goals for this phase

Do not implement these yet:

- Supabase or MongoDB integration
- Authentication
- Real local database persistence
- Voice recording or speech-to-text
- AI assistant model execution
- Real analytics calculations beyond simple mock examples
- Push notifications
- Production-grade sync

The purpose is to create the design system, reusable components, navigation, and static screens that future features will use.

## Recommended stack

Use the existing Expo SDK 57 project and add the following frontend stack:

- Expo React Native
- TypeScript
- Expo Router for navigation
- NativeWind for Tailwind-style styling in React Native
- React Native Safe Area Context
- Lucide React Native for icons
- React Hook Form and Zod later for real forms
- Zustand later for lightweight app state

For this phase, React Hook Form, Zod, and Zustand can be installed now if useful, but they do not need deep integration yet.

## First implementation priority

The first sprint should produce:

1. NativeWind configured and working.
2. A clean folder structure.
3. Design tokens for colors, spacing, typography, radii, and shadows.
4. Core reusable UI components.
5. Finance-specific reusable components.
6. Static screens using mock Dinary data.
7. A small mock data layer that future real data can replace.

## Design direction

Dinary should feel:

- Clean
- Calm
- Trustworthy
- Tunisian, but not visually noisy
- Friendly enough for personal use
- Serious enough to become a public product later

Use a soft, warm finance palette instead of a generic crypto/neobank style.

Suggested colors:

```ts
export const colors = {
  background: "#F8F6F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F1EFE7",
  primary: "#0F766E",
  primaryDark: "#115E59",
  primarySoft: "#CCFBF1",
  accent: "#D97706",
  accentSoft: "#FEF3C7",
  income: "#16A34A",
  expense: "#DC2626",
  warning: "#F59E0B",
  text: "#111827",
  textMuted: "#6B7280",
  textSoft: "#9CA3AF",
  border: "#E5E7EB",
  black: "#020617",
  white: "#FFFFFF",
};
```

The first UI should support light mode only. Prepare the token structure so dark mode can be added later, but do not spend time implementing full dark mode in this phase.

## Naming conventions

Use the following names:

- Product/app name: `Dinary`
- Repository/project slug: `dinary`
- AI assistant name: `Hsebli`
- Currency: `TND`
- Default locale assumption: Tunisia

Example product copy:

- `Win yemchi dinarek?`
- `Track your TND spending`
- `Add expense`
- `Add income`
- `Ask Hsebli`

Keep most UI text in English for now, but allow Tunisian/Arabic-flavored labels where it improves the brand. Future localization can support English, French, Arabic, and Tunisian Arabic.

## Suggested folder structure

Create or adapt the project toward this structure:

```txt
src/
  app/
    _layout.tsx
    index.tsx
    transactions/
      index.tsx
    add-transaction/
      index.tsx
    salary/
      index.tsx
    assistant/
      index.tsx

  components/
    ui/
      Badge.tsx
      Button.tsx
      Card.tsx
      EmptyState.tsx
      Input.tsx
      Text.tsx
    finance/
      Amount.tsx
      BalanceCard.tsx
      CategoryChip.tsx
      MonthSummaryCard.tsx
      TransactionItem.tsx
      VoiceButton.tsx
    layout/
      Header.tsx
      Screen.tsx

  constants/
    categories.ts
    colors.ts
    mock-data.ts

  features/
    assistant/
    salary/
    transactions/

  lib/
    cn.ts
    format-date.ts
    format-money.ts

  types/
    transaction.ts
```

If the existing Expo Router setup uses `app/` at the repository root instead of `src/app/`, keep the existing router convention. Do not break Expo Router just to match this exact tree. The important part is the separation between route files, reusable components, constants, utilities, and types.

## NativeWind setup

Configure NativeWind for the existing Expo SDK 57 app.

Expected files may include:

- `tailwind.config.js`
- `babel.config.js`
- `global.css`
- `nativewind-env.d.ts`

Tailwind content paths should include all app and source files, for example:

```js
content: [
  "./app/**/*.{js,jsx,ts,tsx}",
  "./src/**/*.{js,jsx,ts,tsx}",
  "./components/**/*.{js,jsx,ts,tsx}",
]
```

Add Dinary theme colors to the Tailwind config so components can use semantic class names where possible.

Use a small `cn` utility for class merging:

```ts
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
```

If a stronger class merge utility is already installed, use it. Otherwise keep this simple function for now.

## Core UI components

Build the following reusable components first.

### `Screen`

Wrapper for every screen.

Responsibilities:

- Handles safe area.
- Applies default background.
- Provides consistent horizontal padding.
- Supports scrollable and non-scrollable mode.

Suggested props:

```ts
type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
};
```

### `Text`

Small wrapper around React Native text.

Supported variants:

- `title`
- `subtitle`
- `body`
- `caption`
- `label`
- `amount`

Use this to keep typography consistent instead of styling raw text everywhere.

### `Button`

Reusable pressable button.

Variants:

- `primary`
- `secondary`
- `ghost`
- `danger`

Sizes:

- `sm`
- `md`
- `lg`

States:

- default
- pressed
- disabled
- loading

### `Input`

Reusable text input.

Must support:

- label
- placeholder
- value
- error message
- keyboard type
- left icon or prefix
- right icon or action

Finance examples:

- amount input with `TND`
- category search
- notes input

### `Card`

Reusable surface container.

Variants:

- default
- elevated
- muted
- outline

### `Badge`

Small label component.

Examples:

- `Income`
- `Expense`
- `Food`
- `Salary`
- `Recurring`

### `EmptyState`

Reusable empty screen or empty section state.

Examples:

- No transactions yet
- No salary configured
- No insights yet

## Finance-specific components

### `Amount`

Formats and displays TND amounts consistently.

Requirements:

- Uses `TND` suffix.
- Supports positive, negative, and neutral modes.
- Expenses should show negative visual treatment.
- Incomes should show positive visual treatment.

Examples:

- `-20.000 TND`
- `+1,500.000 TND`
- `230.500 TND`

Use Tunisian Dinar precision carefully. TND has three decimal places, but the UI can hide `.000` later if desired. For now, use a consistent format.

### `BalanceCard`

Main dashboard card.

Shows:

- Current balance
- Month income
- Month expenses
- Small hint or trend text

Example:

`You spent 32% of your monthly income.`

### `TransactionItem`

Reusable row for a transaction.

Shows:

- Category icon
- Title
- Optional note
- Date
- Amount
- Expense/income color

Example:

```txt
Food
Mlawi for family · Today
-20.000 TND
```

### `CategoryChip`

Pressable category selector.

Examples:

- Food
- Transport
- Coffee
- Family
- Bills
- Salary
- Health
- Shopping
- Other

### `MonthSummaryCard`

Small analytics card for the home screen.

Examples:

- Biggest category this month
- Daily average spending
- Remaining until next salary

### `VoiceButton`

Static UI placeholder for future voice input.

For now, tapping it can navigate to add transaction or show a non-functional placeholder state. Do not implement real voice recording in this phase.

## Static screens to build

### Home dashboard

Route:

```txt
/ 
```

Purpose:

Give the user a quick money overview.

Sections:

- Greeting/header: `Dinary`
- Current balance card
- Monthly income/expense summary
- Quick actions
  - Add expense
  - Add income
  - Voice entry
  - Ask Hsebli
- Recent transactions
- Small insight card

Mock insight examples:

- `Food is your biggest category this month.`
- `You spent 20.000 TND on family food today.`
- `You have 12 days until next salary.`

### Transactions screen

Route:

```txt
/transactions
```

Purpose:

List all transactions.

Sections:

- Header
- Month filter placeholder
- Category filter chips
- Transaction list grouped by date
- Empty state if no transactions

No real filtering is required yet, but the UI should be ready for it.

### Add transaction screen

Route:

```txt
/add-transaction
```

Purpose:

Static form for adding a manual transaction.

Fields:

- Type: expense or income
- Amount
- Category
- Date
- Note

Actions:

- Save transaction button
- Voice input placeholder

No persistence is required yet. The Save button can show a temporary success placeholder or navigate back.

### Salary setup screen

Route:

```txt
/salary
```

Purpose:

Configure recurring salary.

Fields:

- Salary amount
- Salary day of month
- Label, e.g. `Monthly salary`
- Notes about previous-month salary logic

Important Tunisian salary behavior:

The user may receive the salary for the previous month on a specific day of the current month. Example: on the 3rd day of each month, the user receives the salary of the previous month.

For now, show this as copy/UI only. Real recurring transaction generation can be implemented later.

### Assistant screen

Route:

```txt
/assistant
```

Purpose:

Static UI for Hsebli, the future local AI assistant.

Sections:

- Assistant intro
- Suggested questions
- Mock chat messages

Example suggested questions:

- `Where did my money go this month?`
- `Can I spend 50 TND today?`
- `What category is growing too much?`
- `How much did I spend on food?`

Do not implement real AI in this phase.

## Navigation

Use Expo Router.

Recommended initial navigation:

- A tab or simple stack with:
  - Home
  - Transactions
  - Add
  - Assistant

Salary setup can be accessible from:

- Home quick action
- Settings later
- Direct route during development

If a bottom tab layout is used, keep the center `Add` action visually prominent.

## Mock data

Create mock data in `constants/mock-data.ts` or a similar file.

Example transaction type:

```ts
export type TransactionType = "income" | "expense";

export type TransactionCategory =
  | "food"
  | "transport"
  | "coffee"
  | "family"
  | "bills"
  | "salary"
  | "health"
  | "shopping"
  | "other";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: "TND";
  category: TransactionCategory;
  title: string;
  note?: string;
  date: string;
  createdAt: string;
};
```

Example mock entries:

```ts
export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    type: "expense",
    amount: 20,
    currency: "TND",
    category: "food",
    title: "Mlawi for family",
    note: "Bought food for everyone",
    date: "2026-07-10",
    createdAt: "2026-07-10T12:00:00.000Z",
  },
  {
    id: "txn_002",
    type: "income",
    amount: 1500,
    currency: "TND",
    category: "salary",
    title: "Monthly salary",
    note: "Salary for previous month",
    date: "2026-07-03",
    createdAt: "2026-07-03T09:00:00.000Z",
  },
];
```

## Formatting utilities

Create `format-money.ts`.

Requirements:

- Always format in TND.
- Support signed and unsigned output.
- Keep implementation simple and deterministic.

Suggested API:

```ts
type FormatMoneyOptions = {
  signed?: boolean;
  hideZeroDecimals?: boolean;
};

export function formatMoney(amount: number, options?: FormatMoneyOptions): string {
  // implementation
}
```

Create `format-date.ts`.

Requirements:

- Format transaction dates for list rows.
- For now, simple output is fine: `Today`, `Yesterday`, or `Jul 10`.

## Accessibility and UX rules

Follow these rules from the start:

- Buttons must have clear pressed and disabled states.
- Tap targets should be comfortable on mobile.
- Text contrast should be readable.
- Amount colors should not be the only indicator of income/expense; use signs too.
- Inputs must show labels, not just placeholders.
- Use clear empty states.
- Avoid tiny finance text.

## Coding rules for the agent

When implementing:

- Do not reinitialize the Expo project.
- Preserve existing project files unless they must be changed.
- Use TypeScript.
- Prefer small reusable components.
- Avoid over-engineering a huge design system.
- Build components from the actual screens needed now.
- Keep business logic simple and mock-based in this phase.
- Do not add backend code yet.
- Do not add real voice or AI model code yet.
- Keep styling consistent with NativeWind and shared tokens.
- Make sure the app runs after changes.

## Installation checklist

The implementing agent should inspect the existing package versions first, then install only missing dependencies.

Likely dependencies:

```bash
npm install nativewind tailwindcss lucide-react-native
npm install react-native-safe-area-context
```

Optional later dependencies:

```bash
npm install zustand react-hook-form zod
```

If using Expo Router tabs or icons requires additional Expo-compatible packages, install according to the current Expo SDK 57 setup.

Do not force a package manager switch. If the repo uses `npm`, use `npm`. If it uses `pnpm`, use `pnpm`. If it uses `yarn`, use `yarn`.

## Acceptance criteria

This phase is complete when:

- The app launches successfully.
- NativeWind styling works.
- The app has a consistent Dinary visual identity.
- Core UI components exist and are reused.
- Finance components exist and are reused.
- Home dashboard renders with mock data.
- Transactions screen renders with mock data.
- Add transaction screen renders a static form.
- Salary setup screen renders the previous-month salary concept.
- Assistant screen renders Hsebli mock UI.
- No backend, real voice, or real AI functionality is implemented.
- The code structure is easy for the next agent to extend.

## Suggested first pull request title

```txt
Setup Dinary frontend foundation and static app shell
```

## Suggested commit message

```txt
feat: add frontend foundation for Dinary
```

