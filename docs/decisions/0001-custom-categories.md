# ADR 0001: Local custom transaction categories

- Status: Accepted
- Date: 2026-09-27

## Context

Users could only pick from ten built-in categories. Anything else had to go under "Other", which hid real spending patterns in charts, budgets, and Hsebli answers.

## Decision

- Add a local `custom_categories` SQLite table (migration v5): `id`, `name`, `emoji`, `kind` (`income` | `expense`), `created_at`, `updated_at`.
- Custom IDs are prefixed `custom_` (`CustomCategoryId` type) so they can never collide with built-in IDs. Transactions and budgets reference them through the existing `category` column, so no change to the transactions table is needed.
- A category belongs to one kind. It is only offered for transactions of that type.
- Names are trimmed, limited to 30 characters, and deduplicated case-insensitively per kind. Creating an existing name reuses that category.
- `categoryFor(id, customCategories)` resolves labels. Unknown IDs fall back to "Other".
- The transaction `title` still stores the category name at save time, as before.
- Custom categories are included in the local backup snapshot.

## Consequences

- Analytics, budgets, and filters group by the real custom category instead of "Other". Balance maths is unchanged.
- Renaming and deleting custom categories are not supported yet. A future delete must decide what happens to transactions and budgets that still reference the category, for example moving them to "Other".
- Any future cloud sync maps this table to the spec's `categories` table with a `user_id`.
