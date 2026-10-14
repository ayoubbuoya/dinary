import { categoryFor } from '@/constants/categories';
import { getLocalMonthKey, monthKeyToDate, shiftMonthKey } from './date';
import { formatMoney } from './format-money';
import { getDaysInMonth } from './salary';
import { buildCategoryFacts, sumMillimes, transactionsInMonth, transactionsInMonthRange } from './period-analytics';
import type { CategoryBudget } from '@/types/budget';
import type { CustomCategory } from '@/types/category';
import type { RecurringRule } from '@/types/recurring';
import type { Transaction, TransactionCategory } from '@/types/transaction';

/**
 * Read-only analysis used by Hsebli. Every figure is calculated here from
 * confirmed transactions, so Hsebli can only explain numbers, never invent them.
 */

const expensesOf = (transactions: Transaction[]) => transactions.filter((transaction) => transaction.type === 'expense');
const incomesOf = (transactions: Transaction[]) => transactions.filter((transaction) => transaction.type === 'income');

/** Days of the month that have already started (all of them for a past month, 0 for a future one). */
export function elapsedDaysInMonth(monthKey: string, now = new Date()) {
  const currentKey = getLocalMonthKey(now);
  const start = monthKeyToDate(monthKey);
  const total = getDaysInMonth(start.getFullYear(), start.getMonth());
  if (monthKey < currentKey) return total;
  if (monthKey > currentKey) return 0;
  return now.getDate();
}

export type MonthForecast = {
  monthKey: string;
  daysElapsed: number;
  daysInMonth: number;
  spentSoFarMillimes: number;
  dailyAverageMillimes: number;
  /** Daily average without recurring bills; this is the part that is projected. */
  variableDailyAverageMillimes: number;
  /** Recurring bills expected later this month (seen in past months, not paid yet). */
  fixedPendingMillimes: number;
  projectedExpenseMillimes: number;
  incomeSoFarMillimes: number;
  /** Expected salary that is not confirmed yet. Forecast only, never part of the balance. */
  pendingSalaryMillimes: number;
  projectedNetMillimes: number;
  lastMonthExpenseMillimes: number;
  /** Spending of last month up to the same day, for a fair "pace" comparison. */
  lastMonthSameDayExpenseMillimes: number;
};

/** Straight-line projection of this month's spending from the daily average so far. */
export function forecastMonth(transactions: Transaction[], salaryRule: RecurringRule | undefined, now = new Date()): MonthForecast {
  const monthKey = getLocalMonthKey(now);
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const daysElapsed = Math.max(1, now.getDate());
  const monthTransactions = transactionsInMonth(transactions, monthKey);
  const spentSoFarMillimes = sumMillimes(expensesOf(monthTransactions));
  const incomeSoFarMillimes = sumMillimes(incomesOf(monthTransactions));
  const dailyAverageMillimes = Math.round(spentSoFarMillimes / daysElapsed);

  // Recurring bills (rent, internet…) are counted once, not spread over every day.
  const recurring = detectRecurringExpenses(transactions, [], now);
  const recurringKeys = new Set(recurring.map((item) => item.key));
  const monthExpenses = expensesOf(monthTransactions);
  const fixedPaid = monthExpenses.filter((transaction) => recurringKeys.has(recurringKey(transaction)));
  const paidKeys = new Set(fixedPaid.map(recurringKey));
  const fixedPendingMillimes = recurring.filter((item) => !paidKeys.has(item.key)).reduce((sum, item) => sum + item.averageMillimes, 0);
  const variableSoFar = spentSoFarMillimes - sumMillimes(fixedPaid);
  const variableDaily = Math.round(variableSoFar / daysElapsed);
  const projectedExpenseMillimes = spentSoFarMillimes + variableDaily * (daysInMonth - daysElapsed) + fixedPendingMillimes;

  const salaryConfirmed = monthTransactions.some((transaction) => transaction.type === 'income' && transaction.category === 'salary');
  const pendingSalaryMillimes = salaryRule?.isActive && !salaryConfirmed ? salaryRule.amountMillimes : 0;

  const lastMonthKey = shiftMonthKey(monthKey, -1);
  const lastMonthExpenses = expensesOf(transactionsInMonth(transactions, lastMonthKey));
  const lastMonthSameDayExpenseMillimes = sumMillimes(
    lastMonthExpenses.filter((transaction) => new Date(transaction.occurredAt).getDate() <= daysElapsed),
  );

  return {
    monthKey,
    daysElapsed,
    daysInMonth,
    spentSoFarMillimes,
    dailyAverageMillimes,
    variableDailyAverageMillimes: variableDaily,
    fixedPendingMillimes,
    projectedExpenseMillimes,
    incomeSoFarMillimes,
    pendingSalaryMillimes,
    projectedNetMillimes: incomeSoFarMillimes + pendingSalaryMillimes - projectedExpenseMillimes,
    lastMonthExpenseMillimes: sumMillimes(lastMonthExpenses),
    lastMonthSameDayExpenseMillimes,
  };
}

export type RecurringExpense = {
  /** Grouping key (category + note), used to match this month's payments. */
  key: string;
  label: string;
  category: TransactionCategory;
  averageMillimes: number;
  monthCount: number;
  yearlyCostMillimes: number;
};

export const recurringKey = (transaction: Transaction) =>
  `${transaction.category}|${(transaction.note ?? transaction.title).trim().toLowerCase()}`;

/**
 * Finds expenses that repeat with a similar amount (±15%) in at least 3 of the
 * last 6 months, for example rent, internet, or a gym subscription.
 */
export function detectRecurringExpenses(transactions: Transaction[], customCategories: CustomCategory[] = [], now = new Date()): RecurringExpense[] {
  const endKey = getLocalMonthKey(now);
  const startKey = shiftMonthKey(endKey, -5);
  const groups = new Map<string, Transaction[]>();
  for (const transaction of expensesOf(transactionsInMonthRange(transactions, startKey, endKey))) {
    const key = recurringKey(transaction);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const results: RecurringExpense[] = [];
  for (const [key, group] of groups.entries()) {
    const months = new Set(group.map((transaction) => getLocalMonthKey(new Date(transaction.occurredAt))));
    if (months.size < 3) continue;
    // Bills and subscriptions happen about once a month; daily habits (coffee, food) do not count.
    if (group.length / months.size > 2) continue;
    const amounts = group.map((transaction) => transaction.amountMillimes).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = group.filter((transaction) => Math.abs(transaction.amountMillimes - median) <= median * 0.15);
    const similarMonths = new Set(similar.map((transaction) => getLocalMonthKey(new Date(transaction.occurredAt))));
    if (similarMonths.size < 3) continue;
    const averageMillimes = Math.round(sumMillimes(similar) / similarMonths.size);
    const sample = similar[0];
    const categoryLabel = categoryFor(sample.category, customCategories).label;
    results.push({
      key,
      label: sample.note ? `${sample.note} (${categoryLabel})` : categoryLabel,
      category: sample.category,
      averageMillimes,
      monthCount: similarMonths.size,
      yearlyCostMillimes: averageMillimes * 12,
    });
  }
  return results.sort((a, b) => b.averageMillimes - a.averageMillimes);
}

export type WeekdayPattern = {
  /** Index 0 = Sunday. */
  totalsMillimes: number[];
  topWeekday: number;
  weekendDailyAverageMillimes: number;
  weekdayDailyAverageMillimes: number;
};

export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Spending per weekday. Daily averages count every calendar day in the window, even days with no spending. */
export function analyzeWeekdays(transactions: Transaction[], startDate: Date, endDate: Date): WeekdayPattern | null {
  const expenses = expensesOf(transactions);
  if (expenses.length === 0) return null;
  const totalsMillimes = new Array<number>(7).fill(0);
  for (const transaction of expenses) {
    totalsMillimes[new Date(transaction.occurredAt).getDay()] += transaction.amountMillimes;
  }

  let weekendDays = 0;
  let weekdayDays = 0;
  for (const day = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); day <= endDate; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0 || day.getDay() === 6) weekendDays += 1;
    else weekdayDays += 1;
  }
  const weekendTotal = totalsMillimes[0] + totalsMillimes[6];
  const weekdayTotal = totalsMillimes.slice(1, 6).reduce((sum, value) => sum + value, 0);

  return {
    totalsMillimes,
    topWeekday: totalsMillimes.indexOf(Math.max(...totalsMillimes)),
    weekendDailyAverageMillimes: weekendDays > 0 ? Math.round(weekendTotal / weekendDays) : 0,
    weekdayDailyAverageMillimes: weekdayDays > 0 ? Math.round(weekdayTotal / weekdayDays) : 0,
  };
}

/** Average monthly net savings over the last `count` complete months that have data. */
export function averageMonthlySavings(transactions: Transaction[], now = new Date(), count = 3) {
  const currentKey = getLocalMonthKey(now);
  const nets: number[] = [];
  for (let offset = 1; offset <= 12 && nets.length < count; offset += 1) {
    const monthTransactions = transactionsInMonth(transactions, shiftMonthKey(currentKey, -offset));
    if (monthTransactions.filter((transaction) => transaction.type !== 'transfer').length === 0) continue;
    nets.push(sumMillimes(incomesOf(monthTransactions)) - sumMillimes(expensesOf(monthTransactions)));
  }
  return { averageMillimes: nets.length > 0 ? Math.round(nets.reduce((sum, value) => sum + value, 0) / nets.length) : 0, monthsUsed: nets.length };
}

/** Average spending of one category over the previous `count` months that had any expense. */
export function categoryMonthlyAverage(transactions: Transaction[], category: TransactionCategory, beforeMonthKey: string, count = 3) {
  const totals: number[] = [];
  for (let offset = 1; offset <= 12 && totals.length < count; offset += 1) {
    const expenses = expensesOf(transactionsInMonth(transactions, shiftMonthKey(beforeMonthKey, -offset)));
    if (expenses.length === 0) continue;
    totals.push(sumMillimes(expenses.filter((transaction) => transaction.category === category)));
  }
  return totals.length > 0 ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : null;
}

export type Insight = { tone: 'good' | 'warning' | 'info'; text: string };

type InsightInput = {
  transactions: Transaction[];
  monthKey: string;
  categoryBudgets: CategoryBudget[];
  customCategories: CustomCategory[];
  salaryRule?: RecurringRule;
  now: Date;
};

/** Observations about one month, most important first. They describe facts; they are not financial advice. */
export function generateInsights({ transactions, monthKey, categoryBudgets, customCategories, salaryRule, now }: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const isCurrentMonth = monthKey === getLocalMonthKey(now);
  const monthTransactions = transactionsInMonth(transactions, monthKey);
  const expenses = expensesOf(monthTransactions);
  const spent = sumMillimes(expenses);
  const income = sumMillimes(incomesOf(monthTransactions));
  const categories = buildCategoryFacts(expenses, customCategories);

  if (expenses.length === 0) {
    insights.push({ tone: 'info', text: 'No expenses are recorded for this month yet, so there is nothing to analyse.' });
    return insights;
  }

  // 1. Pace compared to last month at the same day.
  if (isCurrentMonth) {
    const forecast = forecastMonth(transactions, salaryRule, now);
    if (forecast.lastMonthSameDayExpenseMillimes > 0) {
      const change = Math.round(((forecast.spentSoFarMillimes - forecast.lastMonthSameDayExpenseMillimes) / forecast.lastMonthSameDayExpenseMillimes) * 100);
      if (Math.abs(change) >= 10) {
        insights.push({
          tone: change > 0 ? 'warning' : 'good',
          text: `By day ${forecast.daysElapsed} you spent ${formatMoney(forecast.spentSoFarMillimes)}, ${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than at the same point last month (${formatMoney(forecast.lastMonthSameDayExpenseMillimes)}).`,
        });
      }
    }
    if (forecast.projectedNetMillimes < 0 && forecast.incomeSoFarMillimes + forecast.pendingSalaryMillimes > 0) {
      insights.push({
        tone: 'warning',
        text: `At this pace you will spend about ${formatMoney(forecast.projectedExpenseMillimes)} this month, which is ${formatMoney(Math.abs(forecast.projectedNetMillimes))} more than your income${forecast.pendingSalaryMillimes > 0 ? ' (including the expected salary)' : ''}.`,
      });
    }
  }

  // 2. Categories that grew a lot compared to their usual level.
  for (const category of categories.slice(0, 5)) {
    const average = categoryMonthlyAverage(transactions, category.category, monthKey);
    if (average === null || average === 0) continue;
    const diff = category.amountMillimes - average;
    if (category.amountMillimes > average * 1.25 && diff >= 20000) {
      insights.push({
        tone: 'warning',
        text: `${category.emoji} ${category.label} is ${formatMoney(category.amountMillimes)}${isCurrentMonth ? ' so far' : ''}, ${Math.round((diff / average) * 100)}% above your usual ${formatMoney(average)} per month.`,
      });
    }
  }

  // 3. Savings rate.
  if (income > 0) {
    const rate = Math.round(((income - spent) / income) * 100);
    insights.push(
      rate >= 20
        ? { tone: 'good', text: `You kept ${rate}% of your income${isCurrentMonth ? ' so far' : ''} (${formatMoney(income - spent)}).` }
        : rate >= 0
        ? { tone: 'info', text: `You kept ${rate}% of your income${isCurrentMonth ? ' so far' : ''} (${formatMoney(income - spent)}).` }
        : { tone: 'warning', text: `You spent ${formatMoney(spent - income)} more than you earned${isCurrentMonth ? ' so far' : ''} this month.` },
    );
  }

  // 4. Budgets.
  for (const budget of categoryBudgets.filter((item) => !item.monthKey || item.monthKey === monthKey)) {
    const used = sumMillimes(expenses.filter((transaction) => transaction.category === budget.category));
    const percent = budget.amountMillimes > 0 ? Math.round((used / budget.amountMillimes) * 100) : 0;
    const label = categoryFor(budget.category, customCategories).label;
    if (percent >= 100) insights.push({ tone: 'warning', text: `${label} budget is over: ${formatMoney(used)} of ${formatMoney(budget.amountMillimes)} (${percent}%).` });
    else if (percent >= 80) insights.push({ tone: 'warning', text: `${label} budget is at ${percent}% (${formatMoney(budget.amountMillimes - used)} left).` });
  }

  // 5. Concentration in one category.
  const top = categories[0];
  if (top && top.percentage >= 40 && categories.length > 1) {
    insights.push({ tone: 'info', text: `${top.emoji} ${top.label} takes ${top.percentage}% of all spending (${formatMoney(top.amountMillimes)}).` });
  }

  // 6. Small expenses that add up.
  const small = expenses.filter((transaction) => transaction.amountMillimes <= 5000);
  if (small.length >= 5) {
    insights.push({ tone: 'info', text: `${small.length} small expenses (5 TND or less) add up to ${formatMoney(sumMillimes(small))}.` });
  }

  // 7. One big expense.
  const largest = expenses.reduce((best, transaction) => (transaction.amountMillimes > best.amountMillimes ? transaction : best), expenses[0]);
  if (expenses.length > 1 && largest.amountMillimes >= spent * 0.25) {
    insights.push({ tone: 'info', text: `One expense, ${largest.title}${largest.note ? ` (${largest.note})` : ''}, is ${Math.round((largest.amountMillimes / spent) * 100)}% of the month (${formatMoney(largest.amountMillimes)}).` });
  }

  // 8. Weekend habit.
  const start = monthKeyToDate(monthKey);
  const end = isCurrentMonth ? now : new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const weekdays = analyzeWeekdays(monthTransactions, start, end);
  if (weekdays && weekdays.weekdayDailyAverageMillimes > 0 && weekdays.weekendDailyAverageMillimes > weekdays.weekdayDailyAverageMillimes * 1.5) {
    insights.push({ tone: 'info', text: `On weekends you spend about ${formatMoney(weekdays.weekendDailyAverageMillimes)} a day, versus ${formatMoney(weekdays.weekdayDailyAverageMillimes)} on weekdays.` });
  }

  if (!salaryRule) {
    insights.push({ tone: 'info', text: 'Set your expected salary in the Salary screen so I can calculate a safe daily spending pace.' });
  }

  const order = { warning: 0, good: 1, info: 2 } as const;
  return insights.sort((a, b) => order[a.tone] - order[b.tone]);
}
