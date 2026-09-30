import type { AnyBulkWriteOperation, ClientSession, Collection, Db } from 'mongodb';
import type { AccountType } from '@/types/account';
import type { BackupFile, ImportCounts, ImportSummary } from '@/types/api';
import {
  collections,
  fromMillimes,
  toMillimes,
  type AccountDoc,
  type CategoryBudgetDoc,
  type CustomCategoryDoc,
  type RecurringRuleDoc,
  type TransactionDoc,
} from './mongo';
import {
  asBoolean,
  asCategory,
  asEnum,
  asId,
  asInteger,
  asIsoDate,
  asMillimes,
  asMonthKey,
  asObject,
  asOptionalString,
  asString,
  fail,
  type Input,
} from './validation';

/**
 * Cloud backup export and backup import.
 *
 * Import accepts both formats:
 * - version 1: the old phone backup (raw SQLite rows with snake_case columns), and
 * - version 2: a cloud backup made by `exportBackup`.
 *
 * Import rule, per record ID: add it when the cloud does not have it; replace the cloud copy only when the
 * imported copy has a newer `updatedAt`; otherwise skip it. Importing the same file twice therefore changes nothing.
 */

const MAX_IMPORT_RECORDS = 100_000;
const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank_card', 'bank_account', 'e_wallet', 'other'];

type Stamped = { _id: string; updatedAt: string };

/** Reads a field by its camelCase (v2) or snake_case (v1) name. */
function field(row: Input, camel: string, snake: string) {
  return row[camel] !== undefined ? row[camel] : row[snake];
}

function stamps(row: Input, label: string) {
  const createdAt = asIsoDate(field(row, 'createdAt', 'created_at'), `${label} created date`);
  const updatedRaw = field(row, 'updatedAt', 'updated_at');
  return { createdAt, updatedAt: updatedRaw === undefined ? createdAt : asIsoDate(updatedRaw, `${label} updated date`) };
}

function parseAccount(value: unknown): AccountDoc {
  const row = asObject(value, 'Account');
  return {
    _id: asId(row.id ?? row._id, 'Account ID'),
    name: asString(row.name, 'Account name', 100),
    type: asEnum(row.type, ACCOUNT_TYPES, 'Account type'),
    openingBalanceMillimes: toMillimes(
      asMillimes(field(row, 'openingBalanceMillimes', 'opening_balance_millimes') ?? 0, 'Opening balance', { allowZero: true, allowNegative: true }),
    ),
    isArchived: asBoolean(field(row, 'isArchived', 'is_archived'), 'Archived', false),
    ...stamps(row, 'Account'),
  };
}

function parseTransaction(value: unknown): TransactionDoc {
  const row = asObject(value, 'Transaction');
  const groupId = field(row, 'transferGroupId', 'transfer_group_id');
  return {
    _id: asId(row.id ?? row._id, 'Transaction ID'),
    accountId: asId(field(row, 'accountId', 'account_id'), 'Transaction account'),
    type: asEnum(row.type, ['income', 'expense', 'transfer'] as const, 'Transaction type'),
    amountMillimes: toMillimes(asMillimes(field(row, 'amountMillimes', 'amount_millimes'), 'Transaction amount')),
    category: asCategory(row.category, 'Transaction category'),
    title: asString(row.title, 'Transaction title', 200),
    note: asOptionalString(row.note, 'Transaction note', 1000),
    transferGroupId: groupId == null ? null : asId(groupId, 'Transfer group'),
    occurredAt: asIsoDate(field(row, 'occurredAt', 'occurred_at'), 'Transaction date'),
    source: asOptionalString(row.source, 'Transaction source', 40) ?? 'manual',
    status: asEnum(row.status ?? 'confirmed', ['confirmed', 'voided'] as const, 'Transaction status'),
    ...stamps(row, 'Transaction'),
  };
}

function parseRecurringRule(value: unknown): RecurringRuleDoc {
  const row = asObject(value, 'Recurring rule');
  return {
    _id: asId(row.id ?? row._id, 'Rule ID'),
    type: asEnum(row.type, ['income', 'expense'] as const, 'Rule type'),
    // The old SQLite column allowed NULL for a "variable" amount; store that as 0.
    amountMillimes: toMillimes(asMillimes(field(row, 'amountMillimes', 'amount_millimes') ?? 0, 'Rule amount', { allowZero: true })),
    accountId: asId(field(row, 'accountId', 'account_id'), 'Rule account'),
    dayOfMonth: asInteger(field(row, 'dayOfMonth', 'day_of_month'), 'Rule day of month', 1, 31),
    description: asOptionalString(row.description, 'Rule description', 100) ?? 'Monthly salary',
    isActive: asBoolean(field(row, 'isActive', 'is_active'), 'Rule active', true),
    ...stamps(row, 'Rule'),
  };
}

function parseCategoryBudget(value: unknown): CategoryBudgetDoc {
  const row = asObject(value, 'Budget');
  return {
    _id: asId(row.id ?? row._id, 'Budget ID'),
    category: asCategory(row.category, 'Budget category'),
    amountMillimes: toMillimes(asMillimes(field(row, 'amountMillimes', 'amount_millimes'), 'Budget amount')),
    monthKey: asMonthKey(field(row, 'monthKey', 'month_key'), 'Budget month'),
    ...stamps(row, 'Budget'),
  };
}

function parseCustomCategory(value: unknown): CustomCategoryDoc {
  const row = asObject(value, 'Custom category');
  const id = asId(row.id ?? row._id, 'Custom category ID');
  if (!id.startsWith('custom_')) fail('Custom category IDs must start with "custom_".');
  return {
    _id: id,
    name: asString(row.name, 'Custom category name', 60),
    emoji: asString(row.emoji, 'Custom category emoji', 16),
    kind: asEnum(row.kind, ['income', 'expense'] as const, 'Custom category kind'),
    ...stamps(row, 'Custom category'),
  };
}

function list(data: Input, key: string): unknown[] {
  const value = data[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`"${key}" in the backup must be a list.`);
  return value;
}

/** If the file repeats an ID, keep only its newest copy. */
function newestById<T extends Stamped>(docs: T[]): T[] {
  const byId = new Map<string, T>();
  for (const doc of docs) {
    const current = byId.get(doc._id);
    if (!current || doc.updatedAt > current.updatedAt) byId.set(doc._id, doc);
  }
  return [...byId.values()];
}

async function mergeInto<T extends Stamped>(collection: Collection<T>, docs: T[], session: ClientSession): Promise<ImportCounts> {
  const counts: ImportCounts = { added: 0, updated: 0, skipped: 0 };
  if (docs.length === 0) return counts;

  // The generic MongoDB filter types cannot follow `_id: string` through `T`, so these few casts are needed.
  const existing = await collection
    .find({ _id: { $in: docs.map((doc) => doc._id) } } as never, { projection: { _id: 1, updatedAt: 1 }, session })
    .toArray();
  const cloudUpdatedAt = new Map(existing.map((doc) => [doc._id as unknown as string, doc.updatedAt as unknown as string]));

  const operations: AnyBulkWriteOperation<T>[] = [];
  for (const doc of docs) {
    const current = cloudUpdatedAt.get(doc._id);
    if (current === undefined) {
      operations.push({ insertOne: { document: doc as never } });
      counts.added += 1;
    } else if (doc.updatedAt > current) {
      operations.push({ replaceOne: { filter: { _id: doc._id } as never, replacement: doc as never } });
      counts.updated += 1;
    } else {
      counts.skipped += 1;
    }
  }

  if (operations.length) await collection.bulkWrite(operations, { session, ordered: true });
  return counts;
}

export async function importBackup(db: Db, body: unknown): Promise<ImportSummary> {
  const file = asObject(body, 'Backup file');
  if (file.format !== 'dinary-backup') fail('This is not a Dinary backup file.');
  if (file.version !== 1 && file.version !== 2) fail('This backup version is not supported.');
  const data = asObject(file.data, 'Backup data');

  // Validate everything first, so a bad record stops the import before anything is written.
  const accounts = newestById(list(data, 'accounts').map(parseAccount));
  const transactions = newestById(list(data, 'transactions').map(parseTransaction));
  const recurringRules = newestById(list(data, 'recurringRules').map(parseRecurringRule));
  const categoryBudgets = newestById(list(data, 'categoryBudgets').map(parseCategoryBudget));
  const customCategories = newestById(list(data, 'customCategories').map(parseCustomCategory));

  const total = accounts.length + transactions.length + recurringRules.length + categoryBudgets.length + customCategories.length;
  if (total > MAX_IMPORT_RECORDS) fail(`The backup has too many records (${total}).`);

  const c = collections(db);
  const byCollection = await db.client.withSession((session) =>
    // One MongoDB transaction: the import is either fully applied or not applied at all.
    session.withTransaction(async () => ({
      accounts: await mergeInto(c.accounts, accounts, session),
      transactions: await mergeInto(c.transactions, transactions, session),
      recurringRules: await mergeInto(c.recurringRules, recurringRules, session),
      categoryBudgets: await mergeInto(c.categoryBudgets, categoryBudgets, session),
      customCategories: await mergeInto(c.customCategories, customCategories, session),
    })),
  );

  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0, byCollection };
  for (const counts of Object.values(byCollection)) {
    summary.added += counts.added;
    summary.updated += counts.updated;
    summary.skipped += counts.skipped;
  }
  return summary;
}

/** A full cloud backup, including voided transactions and archived accounts, with money as plain millime integers. */
export async function exportBackup(db: Db): Promise<BackupFile> {
  const c = collections(db);
  const [accounts, transactions, recurringRules, categoryBudgets, customCategories] = await Promise.all([
    c.accounts.find().sort({ createdAt: 1 }).toArray(),
    c.transactions.find().sort({ occurredAt: -1 }).toArray(),
    c.recurringRules.find().sort({ createdAt: 1 }).toArray(),
    c.categoryBudgets.find().sort({ createdAt: 1 }).toArray(),
    c.customCategories.find().sort({ createdAt: 1 }).toArray(),
  ]);

  const plain = <T extends { _id: string }>({ _id, ...rest }: T) => ({ id: _id, ...rest });

  return {
    format: 'dinary-backup',
    version: 2,
    source: 'cloud',
    createdAt: new Date().toISOString(),
    data: {
      accounts: accounts.map((doc) => ({ ...plain(doc), openingBalanceMillimes: fromMillimes(doc.openingBalanceMillimes) })),
      transactions: transactions.map((doc) => ({ ...plain(doc), amountMillimes: fromMillimes(doc.amountMillimes) })),
      recurringRules: recurringRules.map((doc) => ({ ...plain(doc), amountMillimes: fromMillimes(doc.amountMillimes) })),
      categoryBudgets: categoryBudgets.map((doc) => ({ ...plain(doc), amountMillimes: fromMillimes(doc.amountMillimes) })),
      customCategories: customCategories.map(plain),
    },
  };
}
