import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

/** Tables mirrored to Supabase; each carries the same sync metadata columns. */
export const SYNCABLE_TABLES = ['accounts', 'transactions', 'recurring_rules', 'category_budgets'] as const;

export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        opening_balance_millimes INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL DEFAULT 'cash',
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        amount_millimes INTEGER NOT NULL CHECK (amount_millimes > 0),
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        transfer_group_id TEXT,
        occurred_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount_millimes INTEGER,
        account_id TEXT NOT NULL,
        day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
        description TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS category_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        amount_millimes INTEGER NOT NULL CHECK (amount_millimes > 0),
        month_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR IGNORE INTO accounts (id, name, type, opening_balance_millimes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'cash', 'Cash (Espèces)', 'cash', 0, now, now,
    );

    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.runAsync('DELETE FROM transactions WHERE id IN (?, ?, ?, ?, ?, ?)', 'txn_001', 'txn_002', 'txn_003', 'txn_004', 'txn_005', 'txn_006');
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    // Add transfer_group_id column to transactions if it doesn't exist
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
    const hasTransferGroup = columns.some((col) => col.name === 'transfer_group_id');
    if (!hasTransferGroup) {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN transfer_group_id TEXT');
    }

    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR IGNORE INTO accounts (id, name, type, opening_balance_millimes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'bank_card', 'Bank Card (Carte)', 'bank_card', 0, now, now,
    );
    await db.runAsync(
      'INSERT OR IGNORE INTO accounts (id, name, type, opening_balance_millimes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'e_dinar', 'e-Dinar / D17', 'e_wallet', 0, now, now,
    );
    await db.runAsync(
      'INSERT OR IGNORE INTO accounts (id, name, type, opening_balance_millimes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'flouci', 'Flouci Wallet', 'e_wallet', 0, now, now,
    );

    currentVersion = 3;
  }

  if (currentVersion === 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        amount_millimes INTEGER NOT NULL CHECK (amount_millimes > 0),
        month_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    // Cloud backup metadata. Existing rows default to 'pending' so the first
    // sync after sign-in uploads everything already on the device.
    for (const table of SYNCABLE_TABLES) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has('deleted_at')) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
      }
      if (!existing.has('sync_state')) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending'`);
      }
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );

      -- When a device edits a record offline and another device changed the same
      -- record, the losing version is preserved here instead of being dropped.
      -- product-spec 7.3 forbids silently discarding a transaction edit.
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        remote_payload TEXT NOT NULL,
        local_updated_at TEXT,
        remote_updated_at TEXT,
        detected_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS sync_conflicts_unresolved_idx ON sync_conflicts(resolved_at);

      CREATE INDEX IF NOT EXISTS accounts_sync_state_idx ON accounts(sync_state);
      CREATE INDEX IF NOT EXISTS transactions_sync_state_idx ON transactions(sync_state);
      CREATE INDEX IF NOT EXISTS recurring_rules_sync_state_idx ON recurring_rules(sync_state);
      CREATE INDEX IF NOT EXISTS category_budgets_sync_state_idx ON category_budgets(sync_state);
    `);

    currentVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}

/** A complete, portable snapshot for a user-initiated local backup. */
export async function getBackupSnapshot(db: SQLiteDatabase) {
  const [accounts, transactions, recurringRules, categoryBudgets] = await Promise.all([
    db.getAllAsync('SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    db.getAllAsync('SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY occurred_at DESC'),
    db.getAllAsync('SELECT * FROM recurring_rules WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    db.getAllAsync('SELECT * FROM category_budgets WHERE deleted_at IS NULL ORDER BY created_at ASC'),
  ]);

  return { accounts, transactions, recurringRules, categoryBudgets };
}

