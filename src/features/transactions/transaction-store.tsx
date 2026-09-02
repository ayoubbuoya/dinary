import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { categoryFor } from '@/constants/categories';
import { accountConfigFor } from '@/constants/accounts';
import { getLocalMonthKey } from '@/lib/date';
import { createBackup, exportTransactionsCsv } from '@/lib/transaction-export';
import { getBackupSnapshot } from '@/features/transactions/database';
import type { Transaction, TransactionCategory, TransactionType } from '@/types/transaction';
import type { Account, AccountType } from '@/types/account';

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

type TransactionRow = {
  id: string;
  account_id: string;
  type: TransactionType;
  amount_millimes: number;
  category: TransactionCategory;
  title: string;
  note: string | null;
  transfer_group_id: string | null;
  occurred_at: string;
  source: string;
};

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance_millimes: number;
  is_archived: number;
};

type TransactionStore = {
  transactions: Transaction[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  balanceMillimes: number;
  monthIncomeMillimes: number;
  monthExpenseMillimes: number;
  isLoading: boolean;
  addTransaction: (transaction: NewTransaction) => Promise<void>;
  addTransfer: (transfer: NewTransfer) => Promise<void>;
  updateTransaction: (id: string, transaction: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  exportCsv: () => Promise<void>;
  backupData: () => Promise<void>;
};

const TransactionContext = createContext<TransactionStore | null>(null);

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    amountMillimes: row.amount_millimes,
    category: row.category,
    title: row.title,
    note: row.note ?? undefined,
    source: row.source,
    transferGroupId: row.transfer_group_id ?? undefined,
    occurredAt: row.occurred_at,
  };
}

export function TransactionProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [txnRows, accRows] = await Promise.all([
      db.getAllAsync<TransactionRow>(
        "SELECT id, account_id, type, amount_millimes, category, title, note, transfer_group_id, occurred_at, source FROM transactions WHERE status = 'confirmed' ORDER BY occurred_at DESC",
      ),
      db.getAllAsync<AccountRow>(
        'SELECT id, name, type, opening_balance_millimes, is_archived FROM accounts WHERE is_archived = 0 ORDER BY created_at ASC',
      ),
    ]);

    setTransactions(txnRows.map(mapRow));
    setAccounts(
      accRows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        openingBalanceMillimes: row.opening_balance_millimes,
        isArchived: Boolean(row.is_archived),
        emoji: accountConfigFor(row.id).emoji,
      })),
    );
  }, [db]);

  useEffect(() => {
    async function load() {
      try {
        await refreshData();
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [refreshData]);

  const addTransaction = useCallback(async (transaction: NewTransaction) => {
    const now = new Date().toISOString();
    const category = categoryFor(transaction.category);
    const targetAccountId = transaction.accountId || 'cash';
    const record: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      accountId: targetAccountId,
      type: transaction.type,
      amountMillimes: transaction.amountMillimes,
      category: transaction.category,
      title: transaction.type === 'income' && transaction.category === 'salary' ? 'Monthly salary' : category.label,
      note: transaction.note?.trim() || undefined,
      source: 'manual',
      occurredAt: transaction.occurredAt,
    };

    await db.runAsync(
      `INSERT INTO transactions (id, account_id, type, amount_millimes, category, title, note, occurred_at, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id, record.accountId, record.type, record.amountMillimes, record.category, record.title,
      record.note ?? null, record.occurredAt, 'manual', 'confirmed', now, now,
    );
    setTransactions((current) => [record, ...current].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
  }, [db]);

  const addTransfer = useCallback(async (transfer: NewTransfer) => {
    const fromAccount = accounts.find((a) => a.id === transfer.fromAccountId) ?? accountConfigFor(transfer.fromAccountId);
    const toAccount = accounts.find((a) => a.id === transfer.toAccountId) ?? accountConfigFor(transfer.toAccountId);
    const groupId = `trf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const outRecord: Transaction = {
      id: `txn_${Date.now()}_out_${Math.random().toString(36).slice(2, 6)}`,
      accountId: transfer.fromAccountId,
      type: 'transfer',
      amountMillimes: transfer.amountMillimes,
      category: 'other',
      title: `Transfer to ${toAccount.name}`,
      note: transfer.note?.trim() || undefined,
      source: 'transfer_out',
      transferGroupId: groupId,
      occurredAt: transfer.occurredAt,
    };

    const inRecord: Transaction = {
      id: `txn_${Date.now()}_in_${Math.random().toString(36).slice(2, 6)}`,
      accountId: transfer.toAccountId,
      type: 'transfer',
      amountMillimes: transfer.amountMillimes,
      category: 'other',
      title: `Transfer from ${fromAccount.name}`,
      note: transfer.note?.trim() || undefined,
      source: 'transfer_in',
      transferGroupId: groupId,
      occurredAt: transfer.occurredAt,
    };

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, type, amount_millimes, category, title, note, transfer_group_id, occurred_at, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        outRecord.id, outRecord.accountId, 'transfer', outRecord.amountMillimes, 'other', outRecord.title,
        outRecord.note ?? null, groupId, outRecord.occurredAt, 'transfer_out', 'confirmed', now, now,
      );
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, type, amount_millimes, category, title, note, transfer_group_id, occurred_at, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        inRecord.id, inRecord.accountId, 'transfer', inRecord.amountMillimes, 'other', inRecord.title,
        inRecord.note ?? null, groupId, inRecord.occurredAt, 'transfer_in', 'confirmed', now, now,
      );
    });

    setTransactions((current) => [outRecord, inRecord, ...current].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
  }, [accounts, db]);

  const updateTransaction = useCallback(async (id: string, transaction: NewTransaction) => {
    const category = categoryFor(transaction.category);
    const title = transaction.type === 'income' && transaction.category === 'salary' ? 'Monthly salary' : category.label;
    const updatedAt = new Date().toISOString();
    const targetAccountId = transaction.accountId || 'cash';

    const result = await db.runAsync(
      `UPDATE transactions
       SET account_id = ?, type = ?, amount_millimes = ?, category = ?, title = ?, note = ?, occurred_at = ?, updated_at = ?
       WHERE id = ? AND status = 'confirmed'`,
      targetAccountId, transaction.type, transaction.amountMillimes, transaction.category, title, transaction.note?.trim() || null,
      transaction.occurredAt, updatedAt, id,
    );
    if (result.changes !== 1) throw new Error('This transaction could not be updated.');

    setTransactions((current) =>
      current
        .map((record) =>
          record.id === id
            ? {
                ...record,
                accountId: targetAccountId,
                type: transaction.type,
                amountMillimes: transaction.amountMillimes,
                category: transaction.category,
                title,
                note: transaction.note?.trim() || undefined,
                occurredAt: transaction.occurredAt,
              }
            : record,
        )
        .sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime()),
    );
  }, [db]);

  const deleteTransaction = useCallback(async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (!target) return;

    const updatedAt = new Date().toISOString();
    if (target.transferGroupId) {
      await db.runAsync(
        "UPDATE transactions SET status = 'voided', updated_at = ? WHERE transfer_group_id = ? AND status = 'confirmed'",
        updatedAt, target.transferGroupId,
      );
      setTransactions((current) => current.filter((record) => record.transferGroupId !== target.transferGroupId));
    } else {
      const result = await db.runAsync("UPDATE transactions SET status = 'voided', updated_at = ? WHERE id = ? AND status = 'confirmed'", updatedAt, id);
      if (result.changes !== 1) throw new Error('This transaction could not be deleted.');
      setTransactions((current) => current.filter((record) => record.id !== id));
    }
  }, [db, transactions]);

  const value = useMemo<TransactionStore>(() => {
    const accountBalances: Record<string, number> = {};
    for (const acc of accounts) {
      accountBalances[acc.id] = acc.openingBalanceMillimes;
    }

    for (const t of transactions) {
      if (t.type === 'income') {
        accountBalances[t.accountId] = (accountBalances[t.accountId] ?? 0) + t.amountMillimes;
      } else if (t.type === 'expense') {
        accountBalances[t.accountId] = (accountBalances[t.accountId] ?? 0) - t.amountMillimes;
      } else if (t.type === 'transfer') {
        if (t.source === 'transfer_out') {
          accountBalances[t.accountId] = (accountBalances[t.accountId] ?? 0) - t.amountMillimes;
        } else if (t.source === 'transfer_in') {
          accountBalances[t.accountId] = (accountBalances[t.accountId] ?? 0) + t.amountMillimes;
        }
      }
    }

    const totalBalanceMillimes = Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0);
    const activeMonth = getLocalMonthKey(new Date());
    const currentMonthTransactions = transactions.filter((transaction) => getLocalMonthKey(new Date(transaction.occurredAt)) === activeMonth);

    return {
      transactions,
      accounts,
      accountBalances,
      balanceMillimes: totalBalanceMillimes,
      monthIncomeMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'income').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      monthExpenseMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      isLoading,
      addTransaction,
      addTransfer,
      updateTransaction,
      deleteTransaction,
      exportCsv: () => exportTransactionsCsv(transactions),
      backupData: async () => createBackup(await getBackupSnapshot(db)),
    };
  }, [accounts, addTransaction, addTransfer, db, deleteTransaction, isLoading, transactions, updateTransaction]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const store = useContext(TransactionContext);
  if (!store) throw new Error('useTransactions must be used within TransactionProvider');
  return store;
}

