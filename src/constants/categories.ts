import type { TransactionCategory } from '@/types/transaction';

export const categories: { id: TransactionCategory; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍽️' }, { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' }, { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' }, { id: 'bills', label: 'Bills', emoji: '🧾' },
  { id: 'salary', label: 'Salary', emoji: '💼' }, { id: 'health', label: 'Health', emoji: '💚' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' }, { id: 'other', label: 'Other', emoji: '•' },
];

export const categoryFor = (id: TransactionCategory) => categories.find((category) => category.id === id) ?? categories.at(-1)!;
