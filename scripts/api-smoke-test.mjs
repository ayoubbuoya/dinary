#!/usr/bin/env node
/**
 * End-to-end test of the Dinary API against a running server and a DISPOSABLE MongoDB database.
 *
 * It creates, edits and deletes records, so never point it at your real data. The database name must end in "_test".
 *
 * Usage (two terminals):
 *   1. MONGODB_DB_NAME=dinary_test npx expo start            (with MONGODB_URI, DINARY_PASSWORD, DINARY_SESSION_SECRET in .env.local)
 *   2. API_URL=http://localhost:8081 MONGODB_URI=... MONGODB_DB_NAME=dinary_test DINARY_PASSWORD=... node scripts/api-smoke-test.mjs
 */
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';

const { API_URL = 'http://localhost:8081', MONGODB_URI, MONGODB_DB_NAME = '', DINARY_PASSWORD } = process.env;
if (!MONGODB_URI || !DINARY_PASSWORD) throw new Error('Set MONGODB_URI and DINARY_PASSWORD.');
if (!MONGODB_DB_NAME.endsWith('_test')) throw new Error('Refusing to run: MONGODB_DB_NAME must end with "_test".');

const mongo = new MongoClient(MONGODB_URI);
const db = mongo.db(MONGODB_DB_NAME);
let token = '';

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
}

async function step(name, run) {
  await run();
  console.log(`✓ ${name}`);
}

try {
  await db.dropDatabase();
  const iso = (date) => new Date(date).toISOString();

  await step('rejects requests without a session', async () => {
    assert.equal((await api('/api/data', { auth: false })).status, 401);
  });

  await step('rejects a wrong password', async () => {
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { password: 'wrong', client: 'native' } })).status, 401);
  });

  await step('web login sets an HttpOnly cookie and returns no token', async () => {
    const result = await api('/api/auth/login', { method: 'POST', body: { password: DINARY_PASSWORD, client: 'web' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.token, undefined);
    assert.match(result.headers.get('set-cookie') ?? '', /dinary_session=.+HttpOnly; SameSite=Strict/);
  });

  await step('cookie writes from another website are blocked', async () => {
    const login = await api('/api/auth/login', { method: 'POST', body: { password: DINARY_PASSWORD, client: 'web' } });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const result = await api('/api/transactions', {
      method: 'POST', auth: false, headers: { Cookie: cookie, Origin: 'https://evil.example' },
      body: { type: 'expense', amountMillimes: 1000, category: 'food', occurredAt: iso(Date.now()) },
    });
    assert.equal(result.status, 403);
  });

  await step('native login returns a token', async () => {
    const result = await api('/api/auth/login', { method: 'POST', body: { password: DINARY_PASSWORD, client: 'native' } });
    assert.equal(result.status, 200);
    token = result.body.token;
    assert.ok(token);
  });

  await step('a new database has the four default accounts in order', async () => {
    const { body } = await api('/api/data');
    assert.deepEqual(body.accounts.map((account) => account.id), ['cash', 'bank_card', 'e_dinar', 'flouci']);
  });

  let expenseId;
  await step('creates an expense; amounts are stored as 64-bit integers', async () => {
    const result = await api('/api/transactions', {
      method: 'POST',
      body: { type: 'expense', amountMillimes: 20_500, category: 'food', note: ' Mlawi ', occurredAt: iso('2026-09-10T12:00:00Z') },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.title, 'Food');
    assert.equal(result.body.note, 'Mlawi');
    assert.equal(result.body.accountId, 'cash');
    expenseId = result.body.id;
    const stored = await db.collection('transactions').findOne({ _id: expenseId }, { promoteLongs: false });
    assert.equal(stored.amountMillimes._bsontype, 'Long');
  });

  await step('rejects fractional millimes, bad categories and unknown accounts', async () => {
    const base = { type: 'expense', category: 'food', occurredAt: iso(Date.now()) };
    assert.equal((await api('/api/transactions', { method: 'POST', body: { ...base, amountMillimes: 20.5 } })).status, 400);
    assert.equal((await api('/api/transactions', { method: 'POST', body: { ...base, amountMillimes: 0 } })).status, 400);
    assert.equal((await api('/api/transactions', { method: 'POST', body: { ...base, amountMillimes: 1, category: 'salary' } })).status, 400);
    assert.equal((await api('/api/transactions', { method: 'POST', body: { ...base, amountMillimes: 1, accountId: 'nope' } })).status, 400);
  });

  await step('updates an expense', async () => {
    const result = await api(`/api/transactions/${expenseId}`, {
      method: 'PUT',
      body: { type: 'expense', amountMillimes: 25_000, category: 'groceries', accountId: 'bank_card', occurredAt: iso('2026-09-11T08:00:00Z') },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.amountMillimes, 25_000);
    assert.equal(result.body.title, 'Groceries');
  });

  let transfer;
  await step('creates a linked transfer (both sides)', async () => {
    const result = await api('/api/transfers', {
      method: 'POST',
      body: { fromAccountId: 'cash', toAccountId: 'flouci', amountMillimes: 5_000, occurredAt: iso('2026-09-12T10:00:00Z') },
    });
    assert.equal(result.status, 201);
    transfer = result.body;
    assert.deepEqual(transfer.map((t) => t.source), ['transfer_out', 'transfer_in']);
    assert.equal(transfer[0].transferGroupId, transfer[1].transferGroupId);
    assert.equal((await api(`/api/transactions/${transfer[0].id}`, { method: 'PUT', body: { type: 'expense', amountMillimes: 1, category: 'food', occurredAt: iso(Date.now()) } })).status, 400);
  });

  await step('rejects a transfer to the same account', async () => {
    const result = await api('/api/transfers', { method: 'POST', body: { fromAccountId: 'cash', toAccountId: 'cash', amountMillimes: 1, occurredAt: iso(Date.now()) } });
    assert.equal(result.status, 400);
  });

  await step('deleting one side of a transfer voids both sides', async () => {
    const result = await api(`/api/transactions/${transfer[1].id}`, { method: 'DELETE' });
    assert.deepEqual(result.body.voidedIds.sort(), transfer.map((t) => t.id).sort());
    const { body } = await api('/api/data');
    assert.ok(!body.transactions.some((t) => t.transferGroupId === transfer[0].transferGroupId));
    assert.equal(await db.collection('transactions').countDocuments({ transferGroupId: transfer[0].transferGroupId, status: 'voided' }), 2);
  });

  let rule;
  await step('saves the salary rule once and updates it after', async () => {
    rule = (await api('/api/salary-rule', { method: 'PUT', body: { amountMillimes: 1_500_000, accountId: 'bank_card', dayOfMonth: 3 } })).body;
    const again = (await api('/api/salary-rule', { method: 'PUT', body: { amountMillimes: 1_600_000, accountId: 'bank_card', dayOfMonth: 5 } })).body;
    assert.equal(again.id, rule.id);
    assert.equal(again.amountMillimes, 1_600_000);
    rule = again;
  });

  await step('confirming salary uses the stored rule amount', async () => {
    const result = await api('/api/salary-rule/confirm', { method: 'POST', body: { ruleId: rule.id, amountMillimes: 999 } });
    assert.equal(result.status, 201);
    assert.equal(result.body.amountMillimes, 1_600_000);
    assert.equal(result.body.source, 'recurring');
  });

  await step('sets, updates and removes a budget', async () => {
    const first = (await api('/api/category-budgets', { method: 'PUT', body: { category: 'food', amountMillimes: 200_000 } })).body;
    const second = (await api('/api/category-budgets', { method: 'PUT', body: { category: 'food', amountMillimes: 250_000 } })).body;
    assert.equal(first.budget.id, second.budget.id);
    const removed = (await api('/api/category-budgets', { method: 'PUT', body: { category: 'food', amountMillimes: 0 } })).body;
    assert.equal(removed.deletedId, first.budget.id);
  });

  await step('custom categories are de-duplicated by name', async () => {
    const gym = (await api('/api/custom-categories', { method: 'POST', body: { name: 'My  Gym ', kind: 'expense' } })).body;
    const again = (await api('/api/custom-categories', { method: 'POST', body: { name: 'my gym', kind: 'expense' } })).body;
    assert.equal(gym.name, 'My Gym');
    assert.equal(again.id, gym.id);
    const expense = await api('/api/transactions', { method: 'POST', body: { type: 'expense', amountMillimes: 30_000, category: gym.id, occurredAt: iso(Date.now()) } });
    assert.equal(expense.body.title, 'My Gym');
  });

  await step('updates an opening balance (negative allowed)', async () => {
    const result = await api('/api/accounts/cash', { method: 'PATCH', body: { openingBalanceMillimes: -2_000 } });
    assert.equal(result.body.openingBalanceMillimes, -2_000);
  });

  const oldPhoneBackup = {
    format: 'dinary-backup',
    version: 1,
    createdAt: iso('2026-09-01T00:00:00Z'),
    data: {
      accounts: [{ id: 'e_dinar', name: 'e-Dinar / D17', type: 'e_wallet', opening_balance_millimes: 40_000, is_archived: 0, created_at: iso('2026-08-01T00:00:00Z'), updated_at: iso('2026-08-02T00:00:00Z') }],
      transactions: [
        { id: 'txn_old_1', account_id: 'e_dinar', type: 'expense', amount_millimes: 3_500, category: 'coffee', title: 'Coffee', note: null, transfer_group_id: null, occurred_at: iso('2026-08-20T07:00:00Z'), source: 'manual', status: 'confirmed', created_at: iso('2026-08-20T07:00:00Z'), updated_at: iso('2026-08-20T07:00:00Z') },
        { id: 'txn_old_2', account_id: 'cash', type: 'income', amount_millimes: 100_000, category: 'other', title: 'Other', note: 'gift', transfer_group_id: null, occurred_at: iso('2026-08-21T07:00:00Z'), source: 'manual', status: 'voided', created_at: iso('2026-08-21T07:00:00Z'), updated_at: iso('2026-08-22T07:00:00Z') },
      ],
      recurringRules: [],
      categoryBudgets: [{ id: 'bud_old', category: 'coffee', amount_millimes: 50_000, month_key: null, created_at: iso('2026-08-01T00:00:00Z'), updated_at: iso('2026-08-01T00:00:00Z') }],
      customCategories: [{ id: 'custom_old_pets', name: 'Pets', emoji: '🐾', kind: 'expense', created_at: iso('2026-08-01T00:00:00Z'), updated_at: iso('2026-08-01T00:00:00Z') }],
    },
  };

  await step('imports an old phone (SQLite) backup', async () => {
    const result = await api('/api/backup/import', { method: 'POST', body: oldPhoneBackup });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    // The seeded e_dinar account is older than the phone copy, so it is replaced; everything else is new.
    assert.deepEqual(result.body.byCollection.accounts, { added: 0, updated: 1, skipped: 0 });
    assert.equal(result.body.byCollection.transactions.added, 2);
    const { body } = await api('/api/data');
    assert.equal(body.accounts.find((a) => a.id === 'e_dinar').openingBalanceMillimes, 40_000);
    assert.ok(body.transactions.some((t) => t.id === 'txn_old_1'));
    assert.ok(!body.transactions.some((t) => t.id === 'txn_old_2'), 'voided records stay hidden');
  });

  await step('importing the same backup again changes nothing', async () => {
    const result = await api('/api/backup/import', { method: 'POST', body: oldPhoneBackup });
    assert.equal(result.body.added + result.body.updated, 0);
  });

  await step('an older import never overwrites newer cloud data', async () => {
    const older = structuredClone(oldPhoneBackup);
    older.data = { accounts: [{ ...older.data.accounts[0], id: 'cash', opening_balance_millimes: 1 }] };
    const result = await api('/api/backup/import', { method: 'POST', body: older });
    assert.equal(result.body.skipped, 1);
    const { body } = await api('/api/data');
    assert.equal(body.accounts.find((a) => a.id === 'cash').openingBalanceMillimes, -2_000);
  });

  await step('an invalid backup is rejected before anything is written', async () => {
    const before = await db.collection('transactions').countDocuments();
    const broken = structuredClone(oldPhoneBackup);
    broken.data.transactions.push({ ...broken.data.transactions[0], id: 'txn_bad', amount_millimes: 1.5 });
    broken.data.transactions[0].id = 'txn_new_in_broken_file';
    assert.equal((await api('/api/backup/import', { method: 'POST', body: broken })).status, 400);
    assert.equal(await db.collection('transactions').countDocuments(), before);
  });

  await step('cloud backup round-trips through import', async () => {
    const backup = (await api('/api/backup')).body;
    assert.equal(backup.version, 2);
    assert.ok(backup.data.transactions.some((t) => t.status === 'voided'));
    const result = await api('/api/backup/import', { method: 'POST', body: backup });
    assert.equal(result.body.added + result.body.updated, 0);
  });

  await step('balances add up to integer millimes', async () => {
    const { body } = await api('/api/data');
    for (const t of body.transactions) assert.ok(Number.isSafeInteger(t.amountMillimes));
  });

  console.log('\nAll API checks passed.');
} finally {
  await mongo.close();
}
