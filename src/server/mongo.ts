import { Long, MongoClient, type Db } from 'mongodb';
import { defaultAccounts } from '@/constants/accounts';
import type { AccountType } from '@/types/account';
import type { CategoryKind } from '@/types/category';
import type { TransactionCategory, TransactionType } from '@/types/transaction';
import { mongoDbName, requireEnv } from './env';

/**
 * MongoDB document shapes. `_id` keeps the app's existing text IDs (for example `txn_…`),
 * so records imported from the old SQLite database keep the same identity and imports can be repeated safely.
 * Money is always stored as a BSON 64-bit integer of millimes (see `toMillimes`), never as a double.
 */
export type Millimes = Long | number;

export type AccountDoc = {
  _id: string;
  name: string;
  type: AccountType;
  openingBalanceMillimes: Millimes;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionStatus = 'confirmed' | 'voided';

export type TransactionDoc = {
  _id: string;
  accountId: string;
  type: TransactionType;
  amountMillimes: Millimes;
  category: TransactionCategory;
  title: string;
  note: string | null;
  transferGroupId: string | null;
  occurredAt: string;
  source: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

export type RecurringRuleDoc = {
  _id: string;
  type: 'income' | 'expense';
  amountMillimes: Millimes;
  accountId: string;
  dayOfMonth: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategoryBudgetDoc = {
  _id: string;
  category: TransactionCategory;
  amountMillimes: Millimes;
  monthKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomCategoryDoc = {
  _id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  createdAt: string;
  updatedAt: string;
};

export type LoginAttemptDoc = { ip: string; at: Date };

/** Seeded accounts use this date so any real record (for example from an import) is always "newer". */
export const SEED_TIMESTAMP = new Date(0).toISOString();

export function toMillimes(value: number): Long {
  return Long.fromNumber(value);
}

export function fromMillimes(value: Millimes | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export function collections(db: Db) {
  return {
    accounts: db.collection<AccountDoc>('accounts'),
    transactions: db.collection<TransactionDoc>('transactions'),
    recurringRules: db.collection<RecurringRuleDoc>('recurring_rules'),
    categoryBudgets: db.collection<CategoryBudgetDoc>('category_budgets'),
    customCategories: db.collection<CustomCategoryDoc>('custom_categories'),
    loginAttempts: db.collection<LoginAttemptDoc>('login_attempts'),
  };
}

export type Collections = ReturnType<typeof collections>;

// Serverless functions reuse warm instances, so keep one client per instance instead of one per request.
const cache = globalThis as typeof globalThis & { __dinaryDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const client = new MongoClient(requireEnv('MONGODB_URI'), {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8_000,
    appName: 'dinary',
  });
  await client.connect();
  const db = client.db(mongoDbName());
  await prepareDatabase(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!cache.__dinaryDb) {
    cache.__dinaryDb = connect().catch((error) => {
      // Let the next request try again instead of caching a failed connection forever.
      cache.__dinaryDb = undefined;
      throw error;
    });
  }
  return cache.__dinaryDb;
}

/** Creates indexes and the default accounts. Every step is idempotent, so running it on each cold start is safe. */
async function prepareDatabase(db: Db) {
  const c = collections(db);
  await Promise.all([
    c.transactions.createIndex({ status: 1, occurredAt: -1 }),
    c.transactions.createIndex({ transferGroupId: 1 }, { sparse: true }),
    c.categoryBudgets.createIndex({ category: 1, monthKey: 1 }),
    c.customCategories.createIndex({ kind: 1, name: 1 }),
    // Failed login attempts delete themselves after 15 minutes.
    c.loginAttempts.createIndex({ at: 1 }, { expireAfterSeconds: 15 * 60 }),
    c.loginAttempts.createIndex({ ip: 1, at: 1 }),
  ]);
  await ensureDefaultAccounts(db);
}

/** Adds any missing built-in account (Cash, Card, e-Dinar, Flouci) without touching existing ones. */
export async function ensureDefaultAccounts(db: Db) {
  await collections(db).accounts.bulkWrite(
    defaultAccounts.map((account) => ({
      updateOne: {
        filter: { _id: account.id },
        update: {
          $setOnInsert: {
            name: account.name,
            type: account.type,
            openingBalanceMillimes: toMillimes(0),
            isArchived: false,
            createdAt: SEED_TIMESTAMP,
            updatedAt: SEED_TIMESTAMP,
          },
        },
        upsert: true,
      },
    })),
  );
}
