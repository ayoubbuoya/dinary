import type { Transaction } from '@/types/transaction';

export const mockTransactions: Transaction[] = [
  { id: 'txn_001', type: 'expense', amountMillimes: 20500, category: 'food', title: 'Mlawi for family', note: 'Lunch together', occurredAt: '2026-07-10T12:00:00+01:00' },
  { id: 'txn_002', type: 'expense', amountMillimes: 4800, category: 'coffee', title: 'Morning coffee', occurredAt: '2026-07-10T08:30:00+01:00' },
  { id: 'txn_003', type: 'income', amountMillimes: 1500000, category: 'salary', title: 'Monthly salary', note: 'Salary for June', occurredAt: '2026-07-03T09:00:00+01:00' },
  { id: 'txn_004', type: 'expense', amountMillimes: 126000, category: 'groceries', title: 'Weekly groceries', note: 'Carrefour', occurredAt: '2026-07-09T18:20:00+01:00' },
  { id: 'txn_005', type: 'expense', amountMillimes: 18500, category: 'transport', title: 'Taxi', occurredAt: '2026-07-08T17:45:00+01:00' },
  { id: 'txn_006', type: 'expense', amountMillimes: 162500, category: 'bills', title: 'Internet and utilities', occurredAt: '2026-07-06T10:00:00+01:00' },
];
