import type { SyncableTable } from '@/features/transactions/database';

export type TableSpec = {
  /** Every local column except `sync_state`, in the order used for INSERT. */
  readonly columns: readonly string[];
  /** Columns SQLite stores as 0/1 but Postgres types as boolean. */
  readonly booleanColumns: readonly string[];
};

export const TABLE_SPECS: Record<SyncableTable, TableSpec> = {
  accounts: {
    columns: ['id', 'name', 'type', 'opening_balance_millimes', 'is_archived', 'created_at', 'updated_at', 'deleted_at'],
    booleanColumns: ['is_archived'],
  },
  transactions: {
    columns: [
      'id', 'account_id', 'type', 'amount_millimes', 'category', 'title', 'note',
      'transfer_group_id', 'occurred_at', 'source', 'status', 'created_at', 'updated_at', 'deleted_at',
    ],
    booleanColumns: [],
  },
  recurring_rules: {
    columns: ['id', 'type', 'amount_millimes', 'account_id', 'day_of_month', 'description', 'is_active', 'created_at', 'updated_at', 'deleted_at'],
    booleanColumns: ['is_active'],
  },
  category_budgets: {
    columns: ['id', 'category', 'amount_millimes', 'month_key', 'created_at', 'updated_at', 'deleted_at'],
    booleanColumns: [],
  },
};

/**
 * Accounts must exist remotely before rows that reference them, because the
 * cloud schema enforces a (user_id, account_id) foreign key.
 */
export const SYNC_ORDER: readonly SyncableTable[] = ['accounts', 'transactions', 'recurring_rules', 'category_budgets'];

export type LocalRow = Record<string, unknown>;
export type RemoteRow = Record<string, unknown>;

/** Local SQLite row -> Supabase payload. */
export function toRemoteRow(table: SyncableTable, row: LocalRow, userId: string): RemoteRow {
  const spec = TABLE_SPECS[table];
  const payload: RemoteRow = { user_id: userId };

  for (const column of spec.columns) {
    const value = row[column];
    payload[column] = spec.booleanColumns.includes(column) ? Boolean(value) : value ?? null;
  }

  return payload;
}

/** The subset of SQLite bind values this schema uses. */
export type LocalBindValue = string | number | null;

/** Supabase row -> positional values for a local INSERT following `spec.columns`. */
export function toLocalValues(table: SyncableTable, row: RemoteRow): LocalBindValue[] {
  const spec = TABLE_SPECS[table];

  return spec.columns.map((column): LocalBindValue => {
    const value = row[column];
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'string') return value;
    // Every column in this schema is scalar; anything else is unexpected data
    // and is stored as NULL rather than a stringified object.
    return null;
  });
}

export type LocalSyncState = { updated_at: string; sync_state: string };

export type MergeAction = 'insert' | 'update' | 'skip' | 'conflict';

/**
 * Decides what a pulled remote row should do to the local copy.
 *
 * A local row still marked `pending` holds an edit this device has not uploaded.
 * If the remote copy also moved, the two versions disagree and the caller must
 * record a conflict rather than overwrite either side.
 */
export function decideMerge(local: LocalSyncState | null, remoteUpdatedAt: string): MergeAction {
  if (!local) return 'insert';

  if (local.sync_state === 'pending') {
    return sameInstant(local.updated_at, remoteUpdatedAt) ? 'skip' : 'conflict';
  }

  return Date.parse(remoteUpdatedAt) > Date.parse(local.updated_at) ? 'update' : 'skip';
}

/** Postgres and SQLite render the same instant differently ('+00:00' vs 'Z'). */
function sameInstant(left: string, right: string) {
  return Date.parse(left) === Date.parse(right);
}
