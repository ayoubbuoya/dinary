import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { categoryFor } from '@/constants/categories';
import { apiRequest } from '@/lib/api-client';
import { getLocalMonthKey } from '@/lib/date';
import { exportTransactionsCsv, saveBackupFile } from '@/lib/transaction-export';
import type { BackupFile, FinanceSnapshot, ImportSummary, NewCustomCategory, NewTransaction, NewTransfer } from '@/types/api';
import type { Transaction, TransactionCategory } from '@/types/transaction';
import type { Account } from '@/types/account';
import type { RecurringRule, SalaryRuleInput } from '@/types/recurring';
import type { CategoryBudget } from '@/types/budget';
import type { CustomCategory } from '@/types/category';

export type { NewCustomCategory, NewTransaction, NewTransfer } from '@/types/api';

type TransactionStore = {
  transactions: Transaction[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  recurringRules: RecurringRule[];
  categoryBudgets: CategoryBudget[];
  customCategories: CustomCategory[];
  salaryRule?: RecurringRule;
  balanceMillimes: number;
  monthIncomeMillimes: number;
  monthExpenseMillimes: number;
  isLoading: boolean;
  /** Set when the data could not be loaded from the server. */
  loadError?: string;
  reload: () => Promise<void>;
  addTransaction: (transaction: NewTransaction) => Promise<void>;
  addTransfer: (transfer: NewTransfer) => Promise<void>;
  updateTransaction: (id: string, transaction: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveSalaryRule: (input: SalaryRuleInput) => Promise<void>;
  deleteSalaryRule: (id: string) => Promise<void>;
  confirmSalaryPayment: (salaryRule: RecurringRule, confirmedDate?: Date) => Promise<void>;
  setCategoryBudget: (category: TransactionCategory, amountMillimes: number, monthKey?: string) => Promise<void>;
  deleteCategoryBudget: (id: string) => Promise<void>;
  /** Creates a category, or returns the existing one when the same name already exists for that kind. */
  addCustomCategory: (input: NewCustomCategory) => Promise<CustomCategory>;
  updateAccountOpeningBalance: (accountId: string, openingBalanceMillimes: number) => Promise<void>;
  exportCsv: () => Promise<void>;
  /** Saves a full MongoDB backup file (the "new" backup). */
  downloadCloudBackup: () => Promise<void>;
  /** Imports an old phone backup or a cloud backup into MongoDB, then reloads the data. */
  importBackup: (backup: BackupFile) => Promise<ImportSummary>;
};

const TransactionContext = createContext<TransactionStore | null>(null);

const byNewestFirst = (a: Transaction, b: Transaction) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();

/**
 * Holds the owner's financial data in memory for the screens.
 * MongoDB (through the Dinary API) is the source of truth: every change is sent to the server first,
 * and the screen state is updated only with what the server saved and returned.
 */
export function TransactionProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  /** Fetches everything from the server. State changes happen only after the request finishes. */
  const loadSnapshot = useCallback(async () => {
    try {
      const snapshot = await apiRequest<FinanceSnapshot>('/api/data');
      setTransactions(snapshot.transactions);
      setAccounts(snapshot.accounts);
      setRecurringRules(snapshot.recurringRules);
      setCategoryBudgets(snapshot.categoryBudgets);
      setCustomCategories(snapshot.customCategories);
      setLoadError(undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadOnMount() {
      await loadSnapshot();
    }
    void loadOnMount();
  }, [loadSnapshot]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    await loadSnapshot();
  }, [loadSnapshot]);

  const addTransaction = useCallback(async (transaction: NewTransaction) => {
    const saved = await apiRequest<Transaction>('/api/transactions', { method: 'POST', body: transaction });
    setTransactions((current) => [saved, ...current].sort(byNewestFirst));
  }, []);

  const addTransfer = useCallback(async (transfer: NewTransfer) => {
    const saved = await apiRequest<Transaction[]>('/api/transfers', { method: 'POST', body: transfer });
    setTransactions((current) => [...saved, ...current].sort(byNewestFirst));
  }, []);

  const updateTransaction = useCallback(async (id: string, transaction: NewTransaction) => {
    const saved = await apiRequest<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: transaction });
    setTransactions((current) => current.map((record) => (record.id === id ? saved : record)).sort(byNewestFirst));
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    const { voidedIds } = await apiRequest<{ voidedIds: string[] }>(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const removed = new Set(voidedIds);
    setTransactions((current) => current.filter((record) => !removed.has(record.id)));
  }, []);

  const saveSalaryRule = useCallback(async (input: SalaryRuleInput) => {
    const saved = await apiRequest<RecurringRule>('/api/salary-rule', { method: 'PUT', body: input });
    setRecurringRules((current) => (current.some((rule) => rule.id === saved.id)
      ? current.map((rule) => (rule.id === saved.id ? saved : rule))
      : [...current, saved]));
  }, []);

  const deleteSalaryRule = useCallback(async (id: string) => {
    await apiRequest(`/api/recurring-rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setRecurringRules((current) => current.filter((rule) => rule.id !== id));
  }, []);

  const confirmSalaryPayment = useCallback(async (salaryRuleToConfirm: RecurringRule, confirmedDate = new Date()) => {
    const saved = await apiRequest<Transaction>('/api/salary-rule/confirm', {
      method: 'POST',
      body: { ruleId: salaryRuleToConfirm.id, occurredAt: confirmedDate.toISOString() },
    });
    setTransactions((current) => [saved, ...current].sort(byNewestFirst));
  }, []);

  const setCategoryBudget = useCallback(async (category: TransactionCategory, amountMillimes: number, monthKey?: string) => {
    const { budget, deletedId } = await apiRequest<{ budget: CategoryBudget | null; deletedId?: string }>('/api/category-budgets', {
      method: 'PUT',
      body: { category, amountMillimes: Math.max(0, amountMillimes), monthKey: monthKey ?? null },
    });
    setCategoryBudgets((current) => {
      const withoutDeleted = deletedId ? current.filter((item) => item.id !== deletedId) : current;
      if (!budget) return withoutDeleted;
      return withoutDeleted.some((item) => item.id === budget.id)
        ? withoutDeleted.map((item) => (item.id === budget.id ? budget : item))
        : [...withoutDeleted, budget];
    });
  }, []);

  const deleteCategoryBudget = useCallback(async (id: string) => {
    await apiRequest(`/api/category-budgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setCategoryBudgets((current) => current.filter((budget) => budget.id !== id));
  }, []);

  const addCustomCategory = useCallback(async (input: NewCustomCategory) => {
    const saved = await apiRequest<CustomCategory>('/api/custom-categories', { method: 'POST', body: input });
    setCustomCategories((current) => (current.some((category) => category.id === saved.id) ? current : [...current, saved]));
    return saved;
  }, []);

  const updateAccountOpeningBalance = useCallback(async (accountId: string, openingBalanceMillimes: number) => {
    const saved = await apiRequest<Account>(`/api/accounts/${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: { openingBalanceMillimes },
    });
    setAccounts((current) => current.map((account) => (account.id === accountId ? saved : account)));
  }, []);

  const downloadCloudBackup = useCallback(async () => {
    await saveBackupFile(await apiRequest<BackupFile>('/api/backup'), 'cloud');
  }, []);

  const importBackup = useCallback(async (backup: BackupFile) => {
    const summary = await apiRequest<ImportSummary>('/api/backup/import', { method: 'POST', body: backup });
    await reload();
    return summary;
  }, [reload]);

  const salaryRule = useMemo(() => {
    return recurringRules.find((r) => r.type === 'income' && r.isActive);
  }, [recurringRules]);

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
      recurringRules,
      categoryBudgets,
      customCategories,
      salaryRule,
      balanceMillimes: totalBalanceMillimes,
      monthIncomeMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'income').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      monthExpenseMillimes: currentMonthTransactions.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + transaction.amountMillimes, 0),
      isLoading,
      loadError,
      reload,
      addTransaction,
      addTransfer,
      updateTransaction,
      deleteTransaction,
      saveSalaryRule,
      deleteSalaryRule,
      confirmSalaryPayment,
      setCategoryBudget,
      deleteCategoryBudget,
      addCustomCategory,
      updateAccountOpeningBalance,
      exportCsv: () => exportTransactionsCsv(transactions, customCategories),
      downloadCloudBackup,
      importBackup,
    };
  }, [accounts, addCustomCategory, addTransaction, addTransfer, categoryBudgets, confirmSalaryPayment, customCategories, deleteCategoryBudget, deleteSalaryRule, deleteTransaction, downloadCloudBackup, importBackup, isLoading, loadError, recurringRules, reload, salaryRule, saveSalaryRule, setCategoryBudget, transactions, updateAccountOpeningBalance, updateTransaction]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const store = useContext(TransactionContext);
  if (!store) throw new Error('useTransactions must be used within TransactionProvider');
  return store;
}

/** Returns a `categoryFor` that also knows the user's custom categories. */
export function useCategoryFor() {
  const { customCategories } = useTransactions();
  return useCallback((id: TransactionCategory) => categoryFor(id, customCategories), [customCategories]);
}
