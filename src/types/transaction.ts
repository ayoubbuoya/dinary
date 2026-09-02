export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionCategory = 'food' | 'groceries' | 'transport' | 'coffee' | 'family' | 'bills' | 'salary' | 'health' | 'shopping' | 'other';

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


