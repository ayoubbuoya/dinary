import { categoryFor } from '@/constants/categories';
import { getLocalMonthKey } from './date';
import { calculateSafeDailySpend, getDaysUntilPayday } from './salary';
import type { Account } from '@/types/account';
import type { CategoryBudget, CategoryBudgetStatus } from '@/types/budget';
import type { RecurringRule } from '@/types/recurring';
import type { Transaction, TransactionCategory } from '@/types/transaction';

export type CategoryFact = {
  category: TransactionCategory;
  label: string;
  emoji: string;
  amountMillimes: number;
  percentage: number;
  count: number;
};

export type FinancialFacts = {
  currentMonthKey: string;
  lastMonthKey: string;
  totalBalanceMillimes: number;
  accountBreakdown: { id: string; name: string; emoji: string; balanceMillimes: number }[];
  thisMonthIncomeMillimes: number;
  thisMonthExpenseMillimes: number;
  thisMonthNetSavingsMillimes: number;
  lastMonthIncomeMillimes: number;
  lastMonthExpenseMillimes: number;
  monthOverMonthExpenseDiffMillimes: number;
  sortedCategories: CategoryFact[];
  topCategory?: CategoryFact;
  largestExpense?: Transaction;
  daysUntilPayday: number;
  safeDailySpendRateMillimes: number;
  budgetStatuses: CategoryBudgetStatus[];
  foodSpendMillimes: number;
  transportSpendMillimes: number;
  cafeSnacksSpendMillimes: number;
  microExpensesCount: number;
};

export function extractFinancialFacts(
  transactions: Transaction[],
  accounts: Account[],
  accountBalances: Record<string, number>,
  salaryRule?: RecurringRule,
  categoryBudgets: CategoryBudget[] = [],
  referenceDate = new Date(),
): FinancialFacts {
  const currentMonthKey = getLocalMonthKey(referenceDate);

  // Previous month calculation
  const lastMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const lastMonthKey = getLocalMonthKey(lastMonthDate);

  // Balances
  const totalBalanceMillimes = Object.values(accountBalances).reduce((sum, b) => sum + b, 0);
  const accountBreakdown = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    emoji: acc.emoji,
    balanceMillimes: accountBalances[acc.id] ?? 0,
  }));

  // Filter current & last month transactions
  const currentMonthTransactions = transactions.filter(
    (t) => getLocalMonthKey(new Date(t.occurredAt)) === currentMonthKey,
  );
  const lastMonthTransactions = transactions.filter(
    (t) => getLocalMonthKey(new Date(t.occurredAt)) === lastMonthKey,
  );

  const thisMonthExpenses = currentMonthTransactions.filter((t) => t.type === 'expense');
  const thisMonthIncomes = currentMonthTransactions.filter((t) => t.type === 'income');

  const thisMonthExpenseMillimes = thisMonthExpenses.reduce((sum, t) => sum + t.amountMillimes, 0);
  const thisMonthIncomeMillimes = thisMonthIncomes.reduce((sum, t) => sum + t.amountMillimes, 0);
  const thisMonthNetSavingsMillimes = thisMonthIncomeMillimes - thisMonthExpenseMillimes;

  const lastMonthExpenseMillimes = lastMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountMillimes, 0);
  const lastMonthIncomeMillimes = lastMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amountMillimes, 0);

  const monthOverMonthExpenseDiffMillimes = thisMonthExpenseMillimes - lastMonthExpenseMillimes;

  // Category breakdowns
  const categoryMap = new Map<TransactionCategory, { amount: number; count: number }>();
  for (const t of thisMonthExpenses) {
    const existing = categoryMap.get(t.category) ?? { amount: 0, count: 0 };
    categoryMap.set(t.category, {
      amount: existing.amount + t.amountMillimes,
      count: existing.count + 1,
    });
  }

  const sortedCategories: CategoryFact[] = Array.from(categoryMap.entries())
    .map(([cat, val]) => {
      const info = categoryFor(cat);
      const percentage = thisMonthExpenseMillimes > 0 ? (val.amount / thisMonthExpenseMillimes) * 100 : 0;
      return {
        category: cat,
        label: info.label,
        emoji: info.emoji,
        amountMillimes: val.amount,
        percentage: Math.round(percentage * 10) / 10,
        count: val.count,
      };
    })
    .sort((a, b) => b.amountMillimes - a.amountMillimes);

  const topCategory = sortedCategories[0];

  // Largest single expense
  const largestExpense = [...thisMonthExpenses].sort((a, b) => b.amountMillimes - a.amountMillimes)[0];

  // Micro expenses (e.g. <= 5 TND)
  const microExpenses = thisMonthExpenses.filter((t) => t.amountMillimes <= 5000);

  // Specific Tunisian spend tracking
  const foodSpendMillimes = categoryMap.get('food')?.amount ?? 0;
  const transportSpendMillimes = categoryMap.get('transport')?.amount ?? 0;
  const cafeSnacksSpendMillimes = thisMonthExpenses
    .filter((t) => {
      const lower = `${t.title} ${t.note ?? ''}`.toLowerCase();
      return (
        lower.includes('kahwa') ||
        lower.includes('café') ||
        lower.includes('coffee') ||
        lower.includes('mlawi') ||
        lower.includes('sandwich') ||
        lower.includes('chapati') ||
        lower.includes('snack')
      );
    })
    .reduce((sum, t) => sum + t.amountMillimes, 0);

  // Safe daily spend
  const daysUntilPayday = salaryRule ? getDaysUntilPayday(salaryRule.dayOfMonth, referenceDate) : 0;
  const safeSpendMetrics = salaryRule ? calculateSafeDailySpend(totalBalanceMillimes, daysUntilPayday) : undefined;
  const safeDailySpendRateMillimes = safeSpendMetrics?.dailyRateMillimes ?? 0;

  // Category budget statuses
  const budgetStatuses: CategoryBudgetStatus[] = categoryBudgets.map((b) => {
    const spent = categoryMap.get(b.category)?.amount ?? 0;
    const remaining = b.amountMillimes - spent;
    const percentageUsed = b.amountMillimes > 0 ? (spent / b.amountMillimes) * 100 : 0;
    return {
      category: b.category,
      budgetMillimes: b.amountMillimes,
      spentMillimes: spent,
      remainingMillimes: remaining,
      percentageUsed: Math.round(percentageUsed),
      isOverBudget: remaining < 0,
    };
  });

  return {
    currentMonthKey,
    lastMonthKey,
    totalBalanceMillimes,
    accountBreakdown,
    thisMonthIncomeMillimes,
    thisMonthExpenseMillimes,
    thisMonthNetSavingsMillimes,
    lastMonthIncomeMillimes,
    lastMonthExpenseMillimes,
    monthOverMonthExpenseDiffMillimes,
    sortedCategories,
    topCategory,
    largestExpense,
    daysUntilPayday,
    safeDailySpendRateMillimes,
    budgetStatuses,
    foodSpendMillimes,
    transportSpendMillimes,
    cafeSnacksSpendMillimes,
    microExpensesCount: microExpenses.length,
  };
}
