import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

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
    `);

    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR IGNORE INTO accounts (id, name, type, opening_balance_millimes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'cash', 'Cash', 'cash', 0, now, now,
    );

    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.runAsync('DELETE FROM transactions WHERE id IN (?, ?, ?, ?, ?, ?)', 'txn_001', 'txn_002', 'txn_003', 'txn_004', 'txn_005', 'txn_006');
    currentVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}

/** A complete, portable snapshot for a user-initiated local backup. */
export async function getBackupSnapshot(db: SQLiteDatabase) {
  const [accounts, transactions, recurringRules] = await Promise.all([
    db.getAllAsync('SELECT * FROM accounts ORDER BY created_at ASC'),
    db.getAllAsync('SELECT * FROM transactions ORDER BY occurred_at DESC'),
    db.getAllAsync('SELECT * FROM recurring_rules ORDER BY created_at ASC'),
  ]);

  return { accounts, transactions, recurringRules };
}
