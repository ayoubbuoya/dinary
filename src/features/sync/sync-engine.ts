import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import type { SyncableTable } from '@/features/transactions/database';
import {
  decideMerge,
  SYNC_ORDER,
  TABLE_SPECS,
  toLocalValues,
  toRemoteRow,
  type LocalRow,
  type LocalSyncState,
  type RemoteRow,
} from './sync-mapping';

/** Supabase caps request size; personal-finance volumes stay well inside this. */
const BATCH_SIZE = 500;

const EPOCH = '1970-01-01T00:00:00.000Z';

export type SyncResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
};

const OWNER_KEY = 'owner_user_id';

/**
 * Raised when the signed-in account differs from the account that this device's
 * local database belongs to. Uploading anyway would copy one person's financial
 * records into another person's cloud account.
 */
export class SyncOwnershipError extends Error {
  constructor() {
    super('This device already backs up to a different Dinary account. Sign back in with that account to keep syncing. Your data on this device is safe and unchanged.');
    this.name = 'SyncOwnershipError';
  }
}

async function getMeta(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM sync_meta WHERE key = ?', key);
  return row?.value ?? null;
}

async function setMeta(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', key, value);
}

function cursorKey(table: SyncableTable) {
  return `pull_cursor.${table}`;
}

/** Uploads every locally-pending row for one table. */
async function pushTable(db: SQLiteDatabase, table: SyncableTable, userId: string) {
  const spec = TABLE_SPECS[table];
  const rows = await db.getAllAsync<LocalRow>(
    `SELECT ${spec.columns.join(', ')} FROM ${table} WHERE sync_state = 'pending'`,
  );
  if (rows.length === 0) return 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch.map((row) => toRemoteRow(table, row, userId)), { onConflict: 'user_id,id' });
    if (error) throw new Error(`Failed to upload ${table}: ${error.message}`);

    // Matching on updated_at as well as id means a row edited while the upload
    // was in flight stays pending and is retried, instead of being lost.
    for (const row of batch) {
      await db.runAsync(
        `UPDATE ${table} SET sync_state = 'synced' WHERE id = ? AND updated_at = ?`,
        row.id as string,
        row.updated_at as string,
      );
    }
  }

  return rows.length;
}

async function recordConflict(db: SQLiteDatabase, table: SyncableTable, remote: RemoteRow, localUpdatedAt: string) {
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_conflicts
       (id, table_name, record_id, remote_payload, local_updated_at, remote_updated_at, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    `${table}:${remote.id as string}`,
    table,
    remote.id as string,
    JSON.stringify(remote),
    localUpdatedAt,
    remote.updated_at as string,
    new Date().toISOString(),
  );
}

/** Downloads rows changed since the last successful pull for one table. */
async function pullTable(db: SQLiteDatabase, table: SyncableTable) {
  const spec = TABLE_SPECS[table];
  const placeholders = spec.columns.map(() => '?').join(', ');
  const insertSql = `INSERT OR REPLACE INTO ${table} (${spec.columns.join(', ')}, sync_state) VALUES (${placeholders}, 'synced')`;

  let cursor = (await getMeta(db, cursorKey(table))) ?? EPOCH;
  let pulled = 0;
  let conflicts = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('synced_at', cursor)
      .order('synced_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(`Failed to download ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const remote of data as RemoteRow[]) {
      const local = await db.getFirstAsync<LocalSyncState>(
        `SELECT updated_at, sync_state FROM ${table} WHERE id = ?`,
        remote.id as string,
      );
      const action = decideMerge(local, remote.updated_at as string);

      if (action === 'conflict') {
        await recordConflict(db, table, remote, local!.updated_at);
        conflicts += 1;
        continue;
      }
      if (action === 'skip') continue;

      await db.runAsync(insertSql, toLocalValues(table, remote));
      pulled += 1;
    }

    cursor = data[data.length - 1].synced_at as string;
    // Persist after every page so an interrupted sync resumes where it stopped.
    await setMeta(db, cursorKey(table), cursor);

    if (data.length < BATCH_SIZE) break;
  }

  return { pulled, conflicts };
}

/**
 * Runs a full push-then-pull cycle. Pushing first means this device's offline
 * edits reach the server before remote changes are applied on top.
 *
 * Callers must treat failure as non-fatal: the local database is the
 * operational source of truth and stays usable when sync cannot run.
 */
export async function runSync(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
  const owner = await getMeta(db, OWNER_KEY);
  if (owner && owner !== userId) throw new SyncOwnershipError();
  if (!owner) await setMeta(db, OWNER_KEY, userId);

  let pushed = 0;
  let pulled = 0;
  let conflicts = 0;

  for (const table of SYNC_ORDER) {
    pushed += await pushTable(db, table, userId);
  }

  for (const table of SYNC_ORDER) {
    const result = await pullTable(db, table);
    pulled += result.pulled;
    conflicts += result.conflicts;
  }

  await setMeta(db, 'last_synced_at', new Date().toISOString());

  return { pushed, pulled, conflicts };
}

export async function getLastSyncedAt(db: SQLiteDatabase) {
  return getMeta(db, 'last_synced_at');
}

export async function countPendingChanges(db: SQLiteDatabase) {
  let pending = 0;
  for (const table of SYNC_ORDER) {
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${table} WHERE sync_state = 'pending'`,
    );
    pending += row?.total ?? 0;
  }
  return pending;
}

export async function countUnresolvedConflicts(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM sync_conflicts WHERE resolved_at IS NULL',
  );
  return row?.total ?? 0;
}

/**
 * Forces a complete re-upload for the SAME account: clears the pull cursors and
 * the owner claim and re-queues every local row. Intended for recovery after
 * cloud-side data loss.
 *
 * This is deliberately NOT called on sign-out, and is NOT the remedy for a
 * SyncOwnershipError — running it there would upload the previous user's
 * financial records into the newly signed-in account.
 */
export async function resetSyncState(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM sync_meta');
  for (const table of SYNC_ORDER) {
    await db.runAsync(`UPDATE ${table} SET sync_state = 'pending'`);
  }
}
