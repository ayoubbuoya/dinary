import { getLocalMonthKey } from './date';
import type { RecurringRule } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

/**
 * Returns the maximum days in a given year and month (0-indexed month).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Computes the next upcoming payday date based on the target day of month.
 */
export function getNextPayday(dayOfMonth: number, referenceDate = new Date()): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  const daysInCurrentMonth = getDaysInMonth(year, month);
  const targetDayCurrentMonth = Math.min(dayOfMonth, daysInCurrentMonth);

  if (currentDay < targetDayCurrentMonth) {
    return new Date(year, month, targetDayCurrentMonth);
  }

  // Next month
  const nextMonth = (month + 1) % 12;
  const nextYear = month === 11 ? year + 1 : year;
  const daysInNextMonth = getDaysInMonth(nextYear, nextMonth);
  const targetDayNextMonth = Math.min(dayOfMonth, daysInNextMonth);

  return new Date(nextYear, nextMonth, targetDayNextMonth);
}

/**
 * Computes the number of calendar days remaining until the next payday.
 */
export function getDaysUntilPayday(dayOfMonth: number, referenceDate = new Date()): number {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const nextPayday = getNextPayday(dayOfMonth, referenceDate);
  const nextPaydayNormalized = new Date(nextPayday.getFullYear(), nextPayday.getMonth(), nextPayday.getDate());

  const diffTime = nextPaydayNormalized.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Checks if payday is currently due and has not yet been confirmed for the current month.
 */
export function isPaydayDueForConfirmation(
  salaryRule: RecurringRule | undefined,
  transactions: Transaction[],
  referenceDate = new Date(),
): boolean {
  if (!salaryRule || !salaryRule.isActive) return false;

  const currentDay = referenceDate.getDate();
  const daysInMonth = getDaysInMonth(referenceDate.getFullYear(), referenceDate.getMonth());
  const effectivePayday = Math.min(salaryRule.dayOfMonth, daysInMonth);

  // Payday is due if current day is on or after the expected day of month
  const isPaydayPassed = currentDay >= effectivePayday;
  if (!isPaydayPassed) return false;

  // Check if salary for current month has already been confirmed
  const currentMonthKey = getLocalMonthKey(referenceDate);
  const isAlreadyConfirmedThisMonth = transactions.some(
    (t) =>
      t.type === 'income' &&
      t.category === 'salary' &&
      getLocalMonthKey(new Date(t.occurredAt)) === currentMonthKey,
  );

  return !isAlreadyConfirmedThisMonth;
}

export type SafeSpendStatus = 'healthy' | 'moderate' | 'tight' | 'critical';

export type SafeSpendMetrics = {
  dailyRateMillimes: number;
  daysRemaining: number;
  status: SafeSpendStatus;
  statusLabel: string;
};

/**
 * Calculates the daily safe disposable spending velocity until next salary.
 */
export function calculateSafeDailySpend(
  totalBalanceMillimes: number,
  daysUntilPayday: number,
): SafeSpendMetrics {
  const daysRemaining = Math.max(1, daysUntilPayday);

  if (totalBalanceMillimes <= 0) {
    return {
      dailyRateMillimes: 0,
      daysRemaining,
      status: 'critical',
      statusLabel: 'Over budget',
    };
  }

  const dailyRateMillimes = Math.floor(totalBalanceMillimes / daysRemaining);

  let status: SafeSpendStatus = 'healthy';
  let statusLabel = 'On track';

  if (dailyRateMillimes < 10000) {
    status = 'tight';
    statusLabel = 'Tight budget';
  } else if (dailyRateMillimes < 25000) {
    status = 'moderate';
    statusLabel = 'Moderate pace';
  } else {
    status = 'healthy';
    statusLabel = 'Healthy pace';
  }

  return {
    dailyRateMillimes,
    daysRemaining,
    status,
    statusLabel,
  };
}
