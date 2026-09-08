/// <reference types="jest" />
import { decideMerge, SYNC_ORDER, TABLE_SPECS, toLocalValues, toRemoteRow } from './sync-mapping';

describe('toRemoteRow', () => {
  it('converts SQLite integer booleans to Postgres booleans', () => {
    const remote = toRemoteRow('accounts', {
      id: 'cash', name: 'Cash', type: 'cash', opening_balance_millimes: 20500,
      is_archived: 0, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null,
    }, 'user-1');

    expect(remote.is_archived).toBe(false);
    expect(remote.user_id).toBe('user-1');
    expect(remote.opening_balance_millimes).toBe(20500);
  });

  it('stamps the caller-supplied user id on every row', () => {
    const remote = toRemoteRow('category_budgets', {
      id: 'bud_1', category: 'food', amount_millimes: 100000, month_key: '2026-01',
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null,
    }, 'user-2');

    expect(remote.user_id).toBe('user-2');
  });

  it('preserves millime amounts as exact integers', () => {
    const remote = toRemoteRow('transactions', {
      id: 'txn_1', account_id: 'cash', type: 'expense', amount_millimes: 20500, category: 'food',
      title: 'Food', note: null, transfer_group_id: null, occurred_at: '2026-01-01T00:00:00.000Z',
      source: 'manual', status: 'confirmed', created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null,
    }, 'user-1');

    expect(remote.amount_millimes).toBe(20500);
    expect(Number.isInteger(remote.amount_millimes)).toBe(true);
  });

  it('maps undefined optional columns to null rather than dropping them', () => {
    const remote = toRemoteRow('transactions', {
      id: 'txn_2', account_id: 'cash', type: 'expense', amount_millimes: 1000, category: 'food',
      title: 'Food', occurred_at: '2026-01-01T00:00:00.000Z', source: 'manual', status: 'confirmed',
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }, 'user-1');

    expect(remote.note).toBeNull();
    expect(remote.transfer_group_id).toBeNull();
    expect(remote.deleted_at).toBeNull();
  });
});

describe('toLocalValues', () => {
  it('converts Postgres booleans back to SQLite integers in column order', () => {
    const values = toLocalValues('recurring_rules', {
      user_id: 'user-1', id: 'rec_1', type: 'income', amount_millimes: 2500000, account_id: 'cash',
      day_of_month: 28, description: 'Monthly salary', is_active: true,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null, synced_at: '2026-01-02T00:00:00.000Z',
    });

    expect(values).toHaveLength(TABLE_SPECS.recurring_rules.columns.length);
    expect(values[TABLE_SPECS.recurring_rules.columns.indexOf('is_active')]).toBe(1);
    expect(values[TABLE_SPECS.recurring_rules.columns.indexOf('amount_millimes')]).toBe(2500000);
  });

  it('drops cloud-only columns so they cannot leak into the local insert', () => {
    const columns = TABLE_SPECS.transactions.columns;
    expect(columns).not.toContain('user_id');
    expect(columns).not.toContain('synced_at');
  });

  it('round-trips a row without altering its values', () => {
    const local = {
      id: 'acc_1', name: 'Flouci', type: 'e_wallet', opening_balance_millimes: 0,
      is_archived: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null,
    };

    const roundTripped = toLocalValues('accounts', toRemoteRow('accounts', local, 'user-1'));

    expect(roundTripped).toEqual(TABLE_SPECS.accounts.columns.map((column) => local[column as keyof typeof local]));
  });
});

describe('decideMerge', () => {
  const remoteUpdatedAt = '2026-02-01T12:00:00.000Z';

  it('inserts when the record does not exist locally', () => {
    expect(decideMerge(null, remoteUpdatedAt)).toBe('insert');
  });

  it('updates when the remote copy is newer than a clean local copy', () => {
    expect(decideMerge({ updated_at: '2026-01-01T00:00:00.000Z', sync_state: 'synced' }, remoteUpdatedAt)).toBe('update');
  });

  it('skips when the local copy is newer', () => {
    expect(decideMerge({ updated_at: '2026-03-01T00:00:00.000Z', sync_state: 'synced' }, remoteUpdatedAt)).toBe('skip');
  });

  it('skips when both sides are already at the same instant', () => {
    expect(decideMerge({ updated_at: remoteUpdatedAt, sync_state: 'synced' }, remoteUpdatedAt)).toBe('skip');
  });

  it('flags a conflict instead of discarding an unsynced local edit', () => {
    expect(decideMerge({ updated_at: '2026-01-01T00:00:00.000Z', sync_state: 'pending' }, remoteUpdatedAt)).toBe('conflict');
  });

  it('does not flag a conflict when the pending row is the one that was uploaded', () => {
    expect(decideMerge({ updated_at: remoteUpdatedAt, sync_state: 'pending' }, remoteUpdatedAt)).toBe('skip');
  });

  it('treats equivalent timestamp formats as the same instant', () => {
    // Postgres returns '+00:00' where SQLite stored 'Z'; these must not conflict.
    expect(decideMerge({ updated_at: '2026-02-01T12:00:00.000Z', sync_state: 'pending' }, '2026-02-01T12:00:00+00:00')).toBe('skip');
  });
});

describe('SYNC_ORDER', () => {
  it('pushes accounts before the tables whose foreign keys reference them', () => {
    expect(SYNC_ORDER.indexOf('accounts')).toBeLessThan(SYNC_ORDER.indexOf('transactions'));
    expect(SYNC_ORDER.indexOf('accounts')).toBeLessThan(SYNC_ORDER.indexOf('recurring_rules'));
  });

  it('covers every syncable table exactly once', () => {
    expect([...SYNC_ORDER].sort()).toEqual(Object.keys(TABLE_SPECS).sort());
  });
});
