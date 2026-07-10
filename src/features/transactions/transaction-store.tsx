import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { categoryFor } from '@/constants/categories';
import { mockBalanceMillimes, mockTransactions, monthExpenseMillimes, monthIncomeMillimes } from '@/constants/mock-data';
import type { Transaction, TransactionCategory, TransactionType } from '@/types/transaction';

type NewTransaction = {
  type: Extract<TransactionType, 'income' | 'expense'>;
  amountMillimes: number;
  category: TransactionCategory;
  note?: string;
};

type TransactionStore = {
  transactions: Transaction[];
  balanceMillimes: number;
  monthIncomeMillimes: number;
  monthExpenseMillimes: number;
  addTransaction: (transaction: NewTransaction) => void;
};

const TransactionContext = createContext<TransactionStore | null>(null);

export function TransactionProvider({ children }: PropsWithChildren) {
  const [sessionTransactions, setSessionTransactions] = useState<Transaction[]>([]);

  const value = useMemo<TransactionStore>(() => {
    const sessionIncome = sessionTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amountMillimes, 0);
    const sessionExpenses = sessionTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amountMillimes, 0);

    return {
      transactions: [...sessionTransactions, ...mockTransactions],
      balanceMillimes: mockBalanceMillimes + sessionIncome - sessionExpenses,
      monthIncomeMillimes: monthIncomeMillimes + sessionIncome,
      monthExpenseMillimes: monthExpenseMillimes + sessionExpenses,
      addTransaction: (transaction) => {
        const category = categoryFor(transaction.category);
        setSessionTransactions((current) => [
          {
            id: `session_${Date.now()}`,
            type: transaction.type,
            amountMillimes: transaction.amountMillimes,
            category: transaction.category,
            title: transaction.type === 'income' && transaction.category === 'salary' ? 'Monthly salary' : category.label,
            note: transaction.note?.trim() || undefined,
            occurredAt: new Date().toISOString(),
          },
          ...current,
        ]);
      },
    };
  }, [sessionTransactions]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const store = useContext(TransactionContext);
  if (!store) throw new Error('useTransactions must be used within TransactionProvider');
  return store;
}
