# ADR 0002: Browse past periods and a smarter rule-based Hsebli

- Status: Accepted
- Date: 2026-10-14

## Context

Home and Transactions only showed the current month (and "last month"). Users could not look back at older months or see a full year. Hsebli matched a few keywords and only knew about the current month.

## Decision

- Add pure period analytics in `src/lib/period-analytics.ts` (month, year, and month-range summaries, monthly series). They read confirmed transactions only and ignore transfers.
- `extractFinancialFacts` takes an optional `periodMonthKey`. Month figures follow the selected month; the balance and the safe daily pace always describe today.
- Home gets a month navigator. Transactions gets Month / Year / All time modes with arrows and accepts `month` / `year` route params. A new `/reports` route shows a yearly report.
- Hsebli stays offline and rule-based (no model execution in this phase):
  - `hsebli-parser.ts` reads periods (month names, years, "last N months", this/last month/year), categories (including custom ones), amounts (integer millimes, never floats), and an intent, in English, French, and Derja.
  - `hsebli-analysis.ts` computes forecasts, recurring bills, weekday patterns, savings averages, and insights.
  - The engine keeps a small memory of the last intent, period, and category so follow-ups like "and last month?" work.
- Forecasts are labelled as estimates. Expected salary is used only in forecasts, never in the balance. Recurring bills are counted once in the month projection instead of being spread per day.

## Consequences

- All figures shown by Hsebli come from code, so it can explain but not invent numbers. It still cannot understand free-form questions outside its intents; it says so and shows a snapshot.
- Recurring detection is a heuristic (same category and note, similar amount, about once a month, in 3 of the last 6 months). Notes on bills improve it.
- A future local or remote model can use these same typed facts as its grounding layer.
