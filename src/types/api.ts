import type { Account } from './account';
import type { CategoryBudget } from './budget';
import type { CategoryKind, CustomCategory } from './category';
import type { RecurringRule } from './recurring';
import type { Transaction, TransactionCategory, TransactionType } from './transaction';

/** Everything the app needs to render its screens, loaded once after unlocking. */
export type FinanceSnapshot = {
  accounts: Account[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  categoryBudgets: CategoryBudget[];
  customCategories: CustomCategory[];
};

export type NewTransaction = {
  accountId?: string;
  type: Extract<TransactionType, 'income' | 'expense'>;
  amountMillimes: number;
  category: TransactionCategory;
  note?: string;
  occurredAt: string;
};

export type NewTransfer = {
  fromAccountId: string;
  toAccountId: string;
  amountMillimes: number;
  note?: string;
  occurredAt: string;
};

export type NewCustomCategory = {
  name: string;
  emoji?: string;
  kind: CategoryKind;
};

/**
 * Backup file format.
 * - version 1: the old phone backup, a raw copy of the SQLite rows (snake_case columns).
 * - version 2: the cloud backup, taken from MongoDB (camelCase fields, includes deleted/voided records).
 * Both versions can be imported into MongoDB.
 */
export type BackupFile = {
  format: 'dinary-backup';
  version: 1 | 2;
  createdAt: string;
  source?: 'phone-sqlite' | 'cloud';
  data: Record<string, unknown[]>;
};

export type ImportCounts = { added: number; updated: number; skipped: number };

export type ImportSummary = ImportCounts & {
  byCollection: Record<'accounts' | 'transactions' | 'recurringRules' | 'categoryBudgets' | 'customCategories', ImportCounts>;
};
