import { categoryFor } from '@/constants/categories';
import { getLocalMonthKey, monthKeyDiff, shiftMonthKey } from './date';
import type { CustomCategory } from '@/types/category';
import type { Transaction, TransactionCategory } from '@/types/transaction';

/**
 * Pure analytics helpers for any month, year, or month range.
 * All amounts are integer millimes. Transfers are ignored because they move
 * money between accounts and are neither income nor expense.
 */

export type CategoryFact = {
  category: TransactionCategory;
  label: string;
  emoji: string;
  amountMillimes: number;
  percentage: number;
  count: number;
};

export type PeriodSummary = {
  incomeMillimes: number;
  expenseMillimes: number;
  netMillimes: number;
  /** Net savings as a percentage of income, or null when there is no income. */
  savingsRatePercent: number | null;
  incomeCount: number;
  expenseCount: number;
  categories: CategoryFact[];
  incomeCategories: CategoryFact[];
  largestExpense?: Transaction;
};

export type MonthPoint = {
  monthKey: string;
  incomeMillimes: number;
  expenseMillimes: number;
  netMillimes: number;
  transactionCount: number;
};

export type YearSummary = PeriodSummary & {
  year: number;
  months: MonthPoint[];
  /** Months of the year that have at least one income or expense. */
  activeMonthCount: number;
  averageMonthlyExpenseMillimes: number;
  averageMonthlyIncomeMillimes: number;
  highestExpenseMonth?: MonthPoint;
  lowestExpenseMonth?: MonthPoint;
};

const monthKeyOf = (transaction: Transaction) => getLocalMonthKey(new Date(transaction.occurredAt));

const isIncomeOrExpense = (transaction: Transaction) => transaction.type === 'income' || transaction.type === 'expense';

export function transactionsInMonth(transactions: Transaction[], monthKey: string) {
  return transactions.filter((transaction) => monthKeyOf(transaction) === monthKey);
}

export function transactionsInYear(transactions: Transaction[], year: number) {
  return transactions.filter((transaction) => new Date(transaction.occurredAt).getFullYear() === year);
}

/** Transactions from `startMonthKey` to `endMonthKey`, both included. */
export function transactionsInMonthRange(transactions: Transaction[], startMonthKey: string, endMonthKey: string) {
  return transactions.filter((transaction) => {
    const key = monthKeyOf(transaction);
    return key >= startMonthKey && key <= endMonthKey;
  });
}

export function sumMillimes(transactions: Transaction[]) {
  return transactions.reduce((total, transaction) => total + transaction.amountMillimes, 0);
}

/** Groups transactions by category, sorted from the largest amount to the smallest. */
export function buildCategoryFacts(transactions: Transaction[], customCategories: CustomCategory[] = []): CategoryFact[] {
  const totals = new Map<TransactionCategory, { amount: number; count: number }>();
  let grandTotal = 0;
  for (const transaction of transactions) {
    const existing = totals.get(transaction.category) ?? { amount: 0, count: 0 };
    totals.set(transaction.category, { amount: existing.amount + transaction.amountMillimes, count: existing.count + 1 });
    grandTotal += transaction.amountMillimes;
  }

  return Array.from(totals.entries())
    .map(([category, value]) => {
      const info = categoryFor(category, customCategories);
      const percentage = grandTotal > 0 ? (value.amount / grandTotal) * 100 : 0;
      return {
        category,
        label: info.label,
        emoji: info.emoji,
        amountMillimes: value.amount,
        percentage: Math.round(percentage * 10) / 10,
        count: value.count,
      };
    })
    .sort((first, second) => second.amountMillimes - first.amountMillimes);
}

/** Summarizes transactions that were already filtered to one period. */
export function summarizeTransactions(transactions: Transaction[], customCategories: CustomCategory[] = []): PeriodSummary {
  const expenses = transactions.filter((transaction) => transaction.type === 'expense');
  const incomes = transactions.filter((transaction) => transaction.type === 'income');
  const expenseMillimes = sumMillimes(expenses);
  const incomeMillimes = sumMillimes(incomes);
  const netMillimes = incomeMillimes - expenseMillimes;

  return {
    incomeMillimes,
    expenseMillimes,
    netMillimes,
    savingsRatePercent: incomeMillimes > 0 ? Math.round((netMillimes / incomeMillimes) * 100) : null,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    categories: buildCategoryFacts(expenses, customCategories),
    incomeCategories: buildCategoryFacts(incomes, customCategories),
    largestExpense: expenses.reduce<Transaction | undefined>(
      (largest, transaction) => (!largest || transaction.amountMillimes > largest.amountMillimes ? transaction : largest),
      undefined,
    ),
  };
}

export function summarizeMonth(transactions: Transaction[], monthKey: string, customCategories: CustomCategory[] = []) {
  return summarizeTransactions(transactionsInMonth(transactions, monthKey), customCategories);
}

function toMonthPoint(monthKey: string, transactions: Transaction[]): MonthPoint {
  const counted = transactions.filter(isIncomeOrExpense);
  const incomeMillimes = sumMillimes(counted.filter((transaction) => transaction.type === 'income'));
  const expenseMillimes = sumMillimes(counted.filter((transaction) => transaction.type === 'expense'));
  return { monthKey, incomeMillimes, expenseMillimes, netMillimes: incomeMillimes - expenseMillimes, transactionCount: counted.length };
}

/** One point per month from `startMonthKey` to `endMonthKey`, both included, oldest first. */
export function getMonthlySeries(transactions: Transaction[], startMonthKey: string, endMonthKey: string): MonthPoint[] {
  const byMonth = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = monthKeyOf(transaction);
    if (key < startMonthKey || key > endMonthKey) continue;
    byMonth.set(key, [...(byMonth.get(key) ?? []), transaction]);
  }

  const points: MonthPoint[] = [];
  const length = monthKeyDiff(startMonthKey, endMonthKey);
  for (let offset = 0; offset <= length; offset += 1) {
    const key = shiftMonthKey(startMonthKey, offset);
    points.push(toMonthPoint(key, byMonth.get(key) ?? []));
  }
  return points;
}

export function summarizeYear(transactions: Transaction[], year: number, customCategories: CustomCategory[] = []): YearSummary {
  const yearTransactions = transactionsInYear(transactions, year);
  const summary = summarizeTransactions(yearTransactions, customCategories);
  const months = getMonthlySeries(yearTransactions, `${year}-01`, `${year}-12`);
  const activeMonths = months.filter((month) => month.transactionCount > 0);
  const activeMonthCount = activeMonths.length;
  const monthsWithExpenses = activeMonths.filter((month) => month.expenseMillimes > 0);

  return {
    ...summary,
    year,
    months,
    activeMonthCount,
    averageMonthlyExpenseMillimes: activeMonthCount > 0 ? Math.round(summary.expenseMillimes / activeMonthCount) : 0,
    averageMonthlyIncomeMillimes: activeMonthCount > 0 ? Math.round(summary.incomeMillimes / activeMonthCount) : 0,
    highestExpenseMonth: monthsWithExpenses.reduce<MonthPoint | undefined>(
      (best, month) => (!best || month.expenseMillimes > best.expenseMillimes ? month : best),
      undefined,
    ),
    lowestExpenseMonth: monthsWithExpenses.reduce<MonthPoint | undefined>(
      (best, month) => (!best || month.expenseMillimes < best.expenseMillimes ? month : best),
      undefined,
    ),
  };
}

/** The oldest month that has a transaction, or the reference month when there is none. */
export function getEarliestMonthKey(transactions: Transaction[], referenceDate = new Date()) {
  let earliest = getLocalMonthKey(referenceDate);
  for (const transaction of transactions) {
    const key = monthKeyOf(transaction);
    if (key < earliest) earliest = key;
  }
  return earliest;
}

/** Years that have data, plus the reference year, newest first. */
export function getAvailableYears(transactions: Transaction[], referenceDate = new Date()) {
  const years = new Set<number>([referenceDate.getFullYear()]);
  for (const transaction of transactions) {
    years.add(new Date(transaction.occurredAt).getFullYear());
  }
  return Array.from(years).sort((first, second) => second - first);
}
