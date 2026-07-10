import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { categoryFor } from '@/constants/categories';
import { getLocalMonthKey } from '@/lib/date';
import { createBackup, exportTransactionsCsv } from '@/lib/transaction-export';
import { getBackupSnapshot } from '@/features/transactions/database';
import type { Transaction, TransactionCategory, TransactionType } from '@/types/transaction';

type NewTransaction = {
  type: Extract<TransactionType, 'income' | 'expense'>;
  amountMillimes: number;
  category: TransactionCategory;
  note?: string;
  occurredAt: string;
};

type TransactionRow = {
  id: string;
  type: TransactionType;
  amount_millimes: number;
  category: TransactionCategory;
  title: string;
  note: string | null;
  occurred_at: string;
};

type TransactionStore = {
  transactions: Transaction[];
  balanceMillimes: number;
  monthIncomeMillimes: number;
  monthExpenseMillimes: number;
  isLoading: boolean;
  addTransaction: (transaction: NewTransaction) => Promise<void>;
  updateTransaction: (id: string, transaction: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  exportCsv: () => Promise<void>;
  backupData: () => Promise<void>;
};

const TransactionContext = createContext<TransactionStore | null>(null);

function mapRow(row: TransactionRow): Transaction {
  return { id: row.id, type: row.type, amountMillimes: row.amount_millimes, category: row.category, title: row.title, note: row.note ?? undefined, occurredAt: row.occurred_at };
}

export function TransactionProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTransactions = useCallback(async () => {
    const rows = await db.getAllAsync<TransactionRow>(
      "SELECT id, type, amount_millimes, category, title, note, occurred_at FROM transactions WHERE status = 'confirmed' ORDER BY occurred_at DESC",
    );
    setTransactions(rows.map(mapRow));
  }, [db]);

  useEffect(() => {
    async function load() {
      try {
        await refreshTransactions();
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [refreshTransactions]);

  const addTransaction = useCallback(async (transaction: NewTransaction) => {
    const now = new Date().toISOString();
    const category = categoryFor(transaction.category);
    const record: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: transaction.type,
      amountMillimes: transaction.amountMillimes,
      category: transaction.category,
      title: transaction.type === 'income' && transaction.category === 'salary' ? 'Monthly salary' : category.label,
      note: transaction.note?.trim() || undefined,
      occurredAt: transaction.occurredAt,
    };

    await db.runAsync(
      `INSERT INTO transactions (id, account_id, type, amount_millimes, category, title, note, occurred_at, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id, 'cash', record.type, record.amountMillimes, record.category, record.title,
      record.note ?? null, record.occurredAt, 'manual', 'confirmed', now, now,
    );
    setTransactions((current) => [record, ...current]);
  }, [db]);

  const updateTransaction = useCallback(async (id: string, transaction: NewTransaction) => {
    const category = categoryFor(transaction.category);
    const title = transaction.type === 'income' && transaction.category === 'salary' ? 'Monthly salary' : category.label;
    const updatedAt = new Date().toISOString();
    const result = await db.runAsync(
      `UPDATE transactions
       SET type = ?, amount_millimes = ?, category = ?, title = ?, note = ?, occurred_at = ?, updated_at = ?
       WHERE id = ? AND status = 'confirmed'`,
      transaction.type, transaction.amountMillimes, transaction.category, title, transaction.note?.trim() || null,
      transaction.occurredAt, updatedAt, id,
    );
    if (result.changes !== 1) throw new Error('This transaction could not be updated.');

    setTransactions((current) => current.map((record) => record.id === id ? { ...record, type: transaction.type, amountMillimes: transaction.amountMillimes, category: transaction.category, title, note: transaction.note?.trim() || undefined, occurredAt: transaction.occurredAt } : record).sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime()));
  }, [db]);

  const deleteTransaction = useCallback(async (id: string) => {
    const result = await db.runAsync("UPDATE transactions SET status = 'voided', updated_at = ? WHERE id = ? AND status = 'confirmed'", new Date().toISOString(), id);
    if (result.changes !== 1) throw new Error('This transaction could not be deleted.');
    setTransactions((current) => current.filter((record) => record.id !== id));
  }, [db]);

  const value = useMemo<TransactionStore>(() => {
    const confirmedTransactions = transactions.filter((transaction) => transaction.type !== 'transfer');
    const balanceMillimes = confirmedTransactions.reduce((total, transaction) => total + (transaction.type === 'income' ? transaction.amountMillimes : -transaction.amountMillimes), 0);
    const activeMonth = getLocalMonthKey(new Date());
    const currentMonthTransactions = confirmedTransactions.filter((transaction) => getLocalMonthKey(new Date(transaction.occurredAt)) === activeMonth);

    return {
      transactions,
      balanceMillimes,
      monthIncomeMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'income').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      monthExpenseMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      isLoading,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      exportCsv: () => exportTransactionsCsv(transactions),
      backupData: async () => createBackup(await getBackupSnapshot(db)),
    };
  }, [addTransaction, db, deleteTransaction, isLoading, transactions, updateTransaction]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const store = useContext(TransactionContext);
  if (!store) throw new Error('useTransactions must be used within TransactionProvider');
  return store;
}
