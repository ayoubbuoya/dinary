import { getLocalMonthKey, shiftMonthKey } from './date';
import { buildCategoryFacts, type CategoryFact } from './period-analytics';
import { calculateSafeDailySpend, getDaysUntilPayday } from './salary';
import type { Account } from '@/types/account';
import type { CategoryBudget, CategoryBudgetStatus } from '@/types/budget';
import type { CustomCategory } from '@/types/category';
import type { RecurringRule } from '@/types/recurring';
import type { Transaction, TransactionCategory } from '@/types/transaction';

export type { CategoryFact };

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
  customCategories: CustomCategory[] = [],
  referenceDate = new Date(),
  /**
   * The month to analyse (`YYYY-MM`). Defaults to the month of `referenceDate`.
   * Balances and the safe daily pace always use `referenceDate` (today), because
   * they describe the money available now, not the money of a past month.
   */
  periodMonthKey = getLocalMonthKey(referenceDate),
): FinancialFacts {
  const currentMonthKey = periodMonthKey;
  const lastMonthKey = shiftMonthKey(currentMonthKey, -1);

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
  const sortedCategories: CategoryFact[] = buildCategoryFacts(thisMonthExpenses, customCategories);
  const categoryMap = new Map<TransactionCategory, { amount: number; count: number }>(
    sortedCategories.map((fact) => [fact.category, { amount: fact.amountMillimes, count: fact.count }]),
  );

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
