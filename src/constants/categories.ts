import type { BuiltInCategory, TransactionCategory } from '@/types/transaction';
import type { CategoryKind, CategoryOption, CustomCategory } from '@/types/category';

export const categories: { id: BuiltInCategory; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍽️' }, { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' }, { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' }, { id: 'bills', label: 'Bills', emoji: '🧾' },
  { id: 'salary', label: 'Salary', emoji: '💼' }, { id: 'health', label: 'Health', emoji: '💚' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' }, { id: 'other', label: 'Other', emoji: '•' },
];

/** Emoji choices offered when the user creates a custom category. The first one is the default. */
export const customCategoryEmojis = ['🏷️', '🏋️', '🎓', '🎮', '🐾', '✈️', '🎁', '🏠', '💻', '💸'];

export const MAX_CATEGORY_NAME_LENGTH = 30;

const toOption = (custom: CustomCategory): CategoryOption => ({ id: custom.id, label: custom.name, emoji: custom.emoji });

/**
 * Looks up the label and emoji for any category ID.
 * Pass the user's custom categories so their names resolve; unknown IDs
 * (for example a custom category missing from the list) fall back to "Other".
 */
export const categoryFor = (id: TransactionCategory, customCategories: CustomCategory[] = []): CategoryOption => {
  const builtIn = categories.find((category) => category.id === id);
  if (builtIn) return builtIn;
  const custom = customCategories.find((category) => category.id === id);
  return custom ? toOption(custom) : categories.at(-1)!;
};

/**
 * The chips to offer for a transaction type: income keeps only Salary/Other,
 * expense hides Salary, and custom categories are shown only for their own kind.
 */
export const categoryOptionsFor = (kind: CategoryKind, customCategories: CustomCategory[] = []): CategoryOption[] => [
  ...categories.filter((item) => (kind === 'income' ? item.id === 'salary' || item.id === 'other' : item.id !== 'salary')),
  ...customCategories.filter((custom) => custom.kind === kind).map(toOption),
];

/** Every category (built-in first, then custom) — used by filters that span all types. */
export const allCategoryOptions = (customCategories: CustomCategory[] = []): CategoryOption[] => [
  ...categories,
  ...customCategories.map(toOption),
];

/** True when `id` is a valid choice for the given transaction type. */
export const isCategoryAllowedFor = (id: TransactionCategory, kind: CategoryKind, customCategories: CustomCategory[] = []) =>
  categoryOptionsFor(kind, customCategories).some((option) => option.id === id);
