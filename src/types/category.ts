import type { CustomCategoryId, TransactionCategory } from './transaction';

/** Whether a category is offered for income or for expense transactions. */
export type CategoryKind = 'income' | 'expense';

export type CustomCategory = {
  id: CustomCategoryId;
  name: string;
  emoji: string;
  kind: CategoryKind;
  createdAt: string;
};

/** What the UI needs to render any category (built-in or custom) as a chip or label. */
export type CategoryOption = {
  id: TransactionCategory;
  label: string;
  emoji: string;
};
