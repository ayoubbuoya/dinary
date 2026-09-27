export type TransactionType = 'income' | 'expense' | 'transfer';

/** Categories that ship with the app and always exist. */
export type BuiltInCategory = 'food' | 'groceries' | 'transport' | 'coffee' | 'family' | 'bills' | 'salary' | 'health' | 'shopping' | 'other';

/**
 * User-created categories are stored in the `custom_categories` table.
 * Their IDs always start with `custom_` so they can never collide with a built-in ID.
 */
export type CustomCategoryId = `custom_${string}`;

export type TransactionCategory = BuiltInCategory | CustomCategoryId;

export type Transaction = {
  id: string;
  accountId: string;
  type: TransactionType;
  amountMillimes: number;
  category: TransactionCategory;
  title: string;
  note?: string;
  source?: string;
  transferGroupId?: string;
  occurredAt: string;
};
