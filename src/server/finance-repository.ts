import { randomBytes } from 'node:crypto';
import type { Db } from 'mongodb';
import { MAX_CATEGORY_NAME_LENGTH, categoryFor, customCategoryEmojis, isCategoryAllowedFor } from '@/constants/categories';
import { accountConfigFor, defaultAccounts } from '@/constants/accounts';
import type { Account } from '@/types/account';
import type { FinanceSnapshot } from '@/types/api';
import type { CategoryBudget } from '@/types/budget';
import type { CategoryKind, CustomCategory } from '@/types/category';
import type { RecurringRule } from '@/types/recurring';
import type { CustomCategoryId, Transaction, TransactionCategory } from '@/types/transaction';
import { HttpError } from './http';
import {
  collections,
  ensureDefaultAccounts,
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
} from './validation';

/**
 * All reads and writes of financial records. Routes only parse the request and call these functions.
 * The server, not the client, decides IDs, titles and timestamps, and re-checks every amount and reference.
 */

const MAX_NOTE_LENGTH = 500;

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- Mapping MongoDB documents to the types the app already uses ----------

export function toAccount(doc: AccountDoc): Account {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    openingBalanceMillimes: fromMillimes(doc.openingBalanceMillimes),
    isArchived: doc.isArchived,
    emoji: accountConfigFor(doc._id).emoji,
  };
}

export function toTransaction(doc: TransactionDoc): Transaction {
  return {
    id: doc._id,
    accountId: doc.accountId,
    type: doc.type,
    amountMillimes: fromMillimes(doc.amountMillimes),
    category: doc.category,
    title: doc.title,
    note: doc.note ?? undefined,
    source: doc.source,
    transferGroupId: doc.transferGroupId ?? undefined,
    occurredAt: doc.occurredAt,
  };
}

export function toRecurringRule(doc: RecurringRuleDoc): RecurringRule {
  return {
    id: doc._id,
    type: doc.type,
    amountMillimes: fromMillimes(doc.amountMillimes),
    accountId: doc.accountId,
    dayOfMonth: doc.dayOfMonth,
    description: doc.description,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toCategoryBudget(doc: CategoryBudgetDoc): CategoryBudget {
  return {
    id: doc._id,
    category: doc.category,
    amountMillimes: fromMillimes(doc.amountMillimes),
    monthKey: doc.monthKey ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toCustomCategory(doc: CustomCategoryDoc): CustomCategory {
  return { id: doc._id as CustomCategoryId, name: doc.name, emoji: doc.emoji, kind: doc.kind, createdAt: doc.createdAt };
}

// ---------- Reads ----------

/** Built-in accounts first, in their usual order (Cash, Card, e-Dinar, Flouci), then any others by creation date. */
function byAccountOrder(a: AccountDoc, b: AccountDoc) {
  const rank = (doc: AccountDoc) => {
    const index = defaultAccounts.findIndex((account) => account.id === doc._id);
    return index === -1 ? defaultAccounts.length : index;
  };
  return rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt);
}

export async function getSnapshot(db: Db): Promise<FinanceSnapshot> {
  await ensureDefaultAccounts(db);
  const c = collections(db);
  const [accounts, transactions, recurringRules, categoryBudgets, customCategories] = await Promise.all([
    c.accounts.find({ isArchived: false }).toArray(),
    c.transactions.find({ status: 'confirmed' }).sort({ occurredAt: -1 }).toArray(),
    c.recurringRules.find().sort({ createdAt: 1 }).toArray(),
    c.categoryBudgets.find().sort({ createdAt: 1 }).toArray(),
    c.customCategories.find().sort({ createdAt: 1 }).toArray(),
  ]);

  return {
    accounts: accounts.sort(byAccountOrder).map(toAccount),
    transactions: transactions.map(toTransaction),
    recurringRules: recurringRules.map(toRecurringRule),
    categoryBudgets: categoryBudgets.map(toCategoryBudget),
    customCategories: customCategories.map(toCustomCategory),
  };
}

// ---------- Shared checks ----------

async function requireAccount(db: Db, accountId: unknown, label = 'Account') {
  const id = asId(accountId, label);
  const account = await collections(db).accounts.findOne({ _id: id, isArchived: false });
  if (!account) fail(`${label} was not found.`);
  return account;
}

async function customCategoriesFor(db: Db, category: TransactionCategory): Promise<CustomCategory[]> {
  if (!category.startsWith('custom_')) return [];
  const doc = await collections(db).customCategories.findOne({ _id: category });
  return doc ? [toCustomCategory(doc)] : [];
}

type ParsedEntry = {
  accountId: string;
  type: 'income' | 'expense';
  amountMillimes: number;
  category: TransactionCategory;
  title: string;
  note: string | null;
  occurredAt: string;
};

/** Validates an income/expense body and builds the stored title from the category name at save time. */
async function parseEntry(db: Db, body: unknown): Promise<ParsedEntry> {
  const input = asObject(body);
  const type = asEnum(input.type, ['income', 'expense'] as const, 'Type');
  const amountMillimes = asMillimes(input.amountMillimes, 'Amount');
  const category = asCategory(input.category);
  const account = await requireAccount(db, input.accountId || 'cash');
  const customCategories = await customCategoriesFor(db, category);
  if (!isCategoryAllowedFor(category, type, customCategories)) fail(`This category cannot be used for ${type}.`);

  return {
    accountId: account._id,
    type,
    amountMillimes,
    category,
    title: type === 'income' && category === 'salary' ? 'Monthly salary' : categoryFor(category, customCategories).label,
    note: asOptionalString(input.note, 'Note', MAX_NOTE_LENGTH),
    occurredAt: asIsoDate(input.occurredAt, 'Date'),
  };
}

// ---------- Transactions ----------

export async function createTransaction(db: Db, body: unknown): Promise<Transaction> {
  const entry = await parseEntry(db, body);
  const now = nowIso();
  const doc: TransactionDoc = {
    _id: newId('txn'),
    ...entry,
    amountMillimes: toMillimes(entry.amountMillimes),
    transferGroupId: null,
    source: 'manual',
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).transactions.insertOne(doc);
  return toTransaction(doc);
}

export async function updateTransaction(db: Db, rawId: string, body: unknown): Promise<Transaction> {
  const id = asId(rawId, 'Transaction');
  const { transactions } = collections(db);
  const existing = await transactions.findOne({ _id: id, status: 'confirmed' });
  if (!existing) throw new HttpError(404, 'This transaction could not be found.');
  // Editing one side of a transfer would break the matching pair, so transfers can only be deleted.
  if (existing.type === 'transfer') fail('Transfers cannot be edited. Delete it and create a new one.');

  const entry = await parseEntry(db, body);
  const updated = await transactions.findOneAndUpdate(
    { _id: id, status: 'confirmed' },
    { $set: { ...entry, amountMillimes: toMillimes(entry.amountMillimes), updatedAt: nowIso() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'This transaction could not be updated.');
  return toTransaction(updated);
}

/** Deleting is a soft delete ("voided"), so the record stays in cloud backups. Transfers void both sides. */
export async function voidTransaction(db: Db, rawId: string): Promise<{ voidedIds: string[] }> {
  const id = asId(rawId, 'Transaction');
  const { transactions } = collections(db);
  const target = await transactions.findOne({ _id: id, status: 'confirmed' });
  if (!target) throw new HttpError(404, 'This transaction could not be found.');

  const filter = target.transferGroupId
    ? { transferGroupId: target.transferGroupId, status: 'confirmed' as const }
    : { _id: id, status: 'confirmed' as const };
  const ids = (await transactions.find(filter, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id);
  await transactions.updateMany({ _id: { $in: ids } }, { $set: { status: 'voided', updatedAt: nowIso() } });
  return { voidedIds: ids };
}

export async function createTransfer(db: Db, body: unknown): Promise<Transaction[]> {
  const input = asObject(body);
  const from = await requireAccount(db, input.fromAccountId, 'From account');
  const to = await requireAccount(db, input.toAccountId, 'To account');
  if (from._id === to._id) fail('Choose two different accounts.');

  const amountMillimes = toMillimes(asMillimes(input.amountMillimes, 'Amount'));
  const note = asOptionalString(input.note, 'Note', MAX_NOTE_LENGTH);
  const occurredAt = asIsoDate(input.occurredAt, 'Date');
  const groupId = newId('trf');
  const now = nowIso();
  const base = { type: 'transfer' as const, amountMillimes, category: 'other' as const, note, transferGroupId: groupId, occurredAt, status: 'confirmed' as const, createdAt: now, updatedAt: now };

  const docs: TransactionDoc[] = [
    { ...base, _id: newId('txn_out'), accountId: from._id, title: `Transfer to ${to.name}`, source: 'transfer_out' },
    { ...base, _id: newId('txn_in'), accountId: to._id, title: `Transfer from ${from.name}`, source: 'transfer_in' },
  ];

  // Both sides are written in one MongoDB transaction: either the whole transfer exists or none of it does.
  await db.client.withSession((session) =>
    session.withTransaction(async () => {
      await collections(db).transactions.insertMany(docs, { session });
    }),
  );
  return docs.map(toTransaction);
}

// ---------- Salary / recurring rules ----------

export async function saveSalaryRule(db: Db, body: unknown): Promise<RecurringRule> {
  const input = asObject(body);
  const amountMillimes = asMillimes(input.amountMillimes, 'Salary amount');
  const account = await requireAccount(db, input.accountId);
  const dayOfMonth = asInteger(input.dayOfMonth, 'Day of month', 1, 31);
  const description = asOptionalString(input.description, 'Description', 100) ?? 'Monthly salary';
  const isActive = asBoolean(input.isActive, 'Active', true);
  const now = nowIso();
  const { recurringRules } = collections(db);

  const fields = { amountMillimes: toMillimes(amountMillimes), accountId: account._id, dayOfMonth, description, isActive, updatedAt: now };
  const existing = await recurringRules.findOne({ type: 'income' }, { sort: { createdAt: 1 } });
  if (existing) {
    const updated = await recurringRules.findOneAndUpdate({ _id: existing._id }, { $set: fields }, { returnDocument: 'after' });
    if (!updated) throw new HttpError(409, 'The salary rule could not be updated.');
    return toRecurringRule(updated);
  }

  const doc: RecurringRuleDoc = { _id: newId('rec'), type: 'income', ...fields, createdAt: now };
  await recurringRules.insertOne(doc);
  return toRecurringRule(doc);
}

export async function deleteRecurringRule(db: Db, rawId: string) {
  const id = asId(rawId, 'Rule');
  await collections(db).recurringRules.deleteOne({ _id: id });
  return { deletedId: id };
}

/**
 * Turns an expected salary into a real income transaction.
 * The amount and account come from the stored rule, not from the request, so the client cannot change them here.
 */
export async function confirmSalary(db: Db, body: unknown): Promise<Transaction> {
  const input = asObject(body);
  const ruleId = asId(input.ruleId, 'Salary rule');
  const occurredAt = input.occurredAt === undefined ? nowIso() : asIsoDate(input.occurredAt, 'Date');
  const rule = await collections(db).recurringRules.findOne({ _id: ruleId, type: 'income' });
  if (!rule) throw new HttpError(404, 'The salary rule was not found.');
  const amount = fromMillimes(rule.amountMillimes);
  if (amount <= 0) fail('Set a salary amount before confirming it.');

  const now = nowIso();
  const doc: TransactionDoc = {
    _id: newId('txn_sal'),
    accountId: rule.accountId,
    type: 'income',
    amountMillimes: toMillimes(amount),
    category: 'salary',
    title: rule.description || 'Monthly salary',
    note: 'Confirmed recurring salary',
    transferGroupId: null,
    occurredAt,
    source: 'recurring',
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).transactions.insertOne(doc);
  return toTransaction(doc);
}

// ---------- Budgets ----------

/** Sets a budget for a category (and optional month). An amount of 0 removes the budget. */
export async function setCategoryBudget(db: Db, body: unknown): Promise<{ budget: CategoryBudget | null; deletedId?: string }> {
  const input = asObject(body);
  const category = asCategory(input.category);
  const amountMillimes = asMillimes(input.amountMillimes, 'Budget', { allowZero: true });
  const monthKey = asMonthKey(input.monthKey, 'Month');
  const { categoryBudgets } = collections(db);
  const existing = await categoryBudgets.findOne({ category, monthKey });

  if (amountMillimes === 0) {
    if (!existing) return { budget: null };
    await categoryBudgets.deleteOne({ _id: existing._id });
    return { budget: null, deletedId: existing._id };
  }

  const now = nowIso();
  if (existing) {
    const updated = await categoryBudgets.findOneAndUpdate(
      { _id: existing._id },
      { $set: { amountMillimes: toMillimes(amountMillimes), updatedAt: now } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new HttpError(409, 'The budget could not be updated.');
    return { budget: toCategoryBudget(updated) };
  }

  const doc: CategoryBudgetDoc = { _id: newId('bud'), category, amountMillimes: toMillimes(amountMillimes), monthKey, createdAt: now, updatedAt: now };
  await categoryBudgets.insertOne(doc);
  return { budget: toCategoryBudget(doc) };
}

export async function deleteCategoryBudget(db: Db, rawId: string) {
  const id = asId(rawId, 'Budget');
  await collections(db).categoryBudgets.deleteOne({ _id: id });
  return { deletedId: id };
}

// ---------- Custom categories ----------

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Creates a category, or returns the existing one when the same name already exists for that kind. */
export async function addCustomCategory(db: Db, body: unknown): Promise<CustomCategory> {
  const input = asObject(body);
  const kind = asEnum<CategoryKind>(input.kind, ['income', 'expense'], 'Kind');
  // Collapse repeated spaces so "My  Gym " and "My Gym" are treated as the same name.
  const name = asString(input.name, 'Category name', 200).replace(/\s+/g, ' ');
  if (name.length > MAX_CATEGORY_NAME_LENGTH) fail(`Keep the name under ${MAX_CATEGORY_NAME_LENGTH} characters.`);
  const emoji = asOptionalString(input.emoji, 'Emoji', 16) ?? customCategoryEmojis[0];

  const { customCategories } = collections(db);
  const existing = await customCategories.findOne({ kind, name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
  if (existing) return toCustomCategory(existing);

  const now = nowIso();
  const doc: CustomCategoryDoc = { _id: newId('custom'), name, emoji, kind, createdAt: now, updatedAt: now };
  await customCategories.insertOne(doc);
  return toCustomCategory(doc);
}

// ---------- Accounts ----------

export async function updateAccountOpeningBalance(db: Db, rawId: string, body: unknown): Promise<Account> {
  const account = await requireAccount(db, rawId);
  const input = asObject(body);
  const openingBalanceMillimes = asMillimes(input.openingBalanceMillimes, 'Opening balance', { allowZero: true, allowNegative: true });
  const updated = await collections(db).accounts.findOneAndUpdate(
    { _id: account._id },
    { $set: { openingBalanceMillimes: toMillimes(openingBalanceMillimes), updatedAt: nowIso() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'Account was not found.');
  return toAccount(updated);
}
