import { categoryFor } from '@/constants/categories';
import { endOfMonth, formatMonthKey, formatShortMonth, getLocalMonthKey, monthKeyDiff, monthKeyToDate, shiftMonthKey } from './date';
import { formatMoney } from './format-money';
import { extractFinancialFacts, type CategoryFact, type FinancialFacts } from './financial-facts';
import {
  analyzeWeekdays,
  averageMonthlySavings,
  categoryMonthlyAverage,
  detectRecurringExpenses,
  elapsedDaysInMonth,
  forecastMonth,
  generateInsights,
  weekdayNames,
  type Insight,
} from './hsebli-analysis';
import { hasWord, normalizeQuery, parseHsebliQuery, type HsebliIntent, type HsebliPeriod } from './hsebli-parser';
import {
  buildCategoryFacts,
  getEarliestMonthKey,
  getMonthlySeries,
  sumMillimes,
  summarizeTransactions,
  transactionsInMonth,
  transactionsInMonthRange,
  transactionsInYear,
} from './period-analytics';
import type { Account } from '@/types/account';
import type { CategoryBudget } from '@/types/budget';
import type { CustomCategory } from '@/types/category';
import type { RecurringRule } from '@/types/recurring';
import type { Transaction, TransactionCategory } from '@/types/transaction';

/**
 * Hsebli: an offline, rule-based assistant. It reads typed analytics computed
 * in code and turns them into short explanations. It never changes data and
 * never invents numbers.
 */

export type HsebliFactItem = {
  label: string;
  value: string;
  isHighlight?: boolean;
};

export type HsebliBar = {
  label: string;
  valueMillimes: number;
  tone: 'income' | 'expense' | 'neutral';
};

export type HsebliBullet = { tone: Insight['tone']; text: string };

/** What Hsebli remembers from the last answer, so follow-ups like "and last month?" work. */
export type HsebliMemory = {
  intent?: HsebliIntent;
  period?: HsebliPeriod;
  category?: TransactionCategory;
};

export type HsebliResponse = {
  id: string;
  title: string;
  body: string;
  factsCard?: {
    title: string;
    items: HsebliFactItem[];
  };
  categories?: CategoryFact[];
  bars?: HsebliBar[];
  bullets?: HsebliBullet[];
  suggestedQuestions?: string[];
  memory?: HsebliMemory;
};

export type HsebliData = {
  transactions: Transaction[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  salaryRule?: RecurringRule;
  categoryBudgets: CategoryBudget[];
  customCategories: CustomCategory[];
  now?: Date;
};

type Context = Required<Omit<HsebliData, 'salaryRule'>> & {
  salaryRule?: RecurringRule;
  facts: FinancialFacts;
  currentMonthKey: string;
};

type Request = {
  intent: HsebliIntent;
  period?: HsebliPeriod;
  comparePeriod?: HsebliPeriod;
  category?: TransactionCategory;
  amountMillimes?: number;
  searchTerm?: string;
};

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

const currentMonthPeriod = (ctx: Context): HsebliPeriod => ({ kind: 'month', monthKey: ctx.currentMonthKey });

function periodTransactions(ctx: Context, period: HsebliPeriod) {
  switch (period.kind) {
    case 'month':
      return transactionsInMonth(ctx.transactions, period.monthKey);
    case 'year':
      return transactionsInYear(ctx.transactions, period.year);
    case 'range':
      return transactionsInMonthRange(ctx.transactions, period.startMonthKey, period.endMonthKey);
    default:
      return ctx.transactions;
  }
}

function periodLabel(ctx: Context, period: HsebliPeriod) {
  switch (period.kind) {
    case 'month':
      if (period.monthKey === ctx.currentMonthKey) return 'this month';
      if (period.monthKey === shiftMonthKey(ctx.currentMonthKey, -1)) return `last month (${formatMonthKey(period.monthKey)})`;
      return `in ${formatMonthKey(period.monthKey)}`;
    case 'year':
      return period.year === ctx.now.getFullYear() ? `this year (${period.year})` : `in ${period.year}`;
    case 'range':
      return `from ${formatMonthKey(period.startMonthKey)} to ${formatMonthKey(period.endMonthKey)}`;
    default:
      return 'since you started';
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The period just before, with the same length. */
function previousPeriod(period: HsebliPeriod): HsebliPeriod | undefined {
  switch (period.kind) {
    case 'month':
      return { kind: 'month', monthKey: shiftMonthKey(period.monthKey, -1) };
    case 'year':
      return { kind: 'year', year: period.year - 1 };
    case 'range': {
      const length = monthKeyDiff(period.startMonthKey, period.endMonthKey) + 1;
      return { kind: 'range', startMonthKey: shiftMonthKey(period.startMonthKey, -length), endMonthKey: shiftMonthKey(period.endMonthKey, -length) };
    }
    default:
      return undefined;
  }
}

/** Days that have already happened in the period, used for daily averages. */
function elapsedDays(ctx: Context, period: HsebliPeriod) {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(ctx.now.getFullYear(), ctx.now.getMonth(), ctx.now.getDate());
  const countDays = (start: Date, end: Date) => {
    const last = end < today ? end : today;
    return last < start ? 0 : Math.round((new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime() - start.getTime()) / dayMs) + 1;
  };
  switch (period.kind) {
    case 'month':
      return elapsedDaysInMonth(period.monthKey, ctx.now);
    case 'year':
      return countDays(new Date(period.year, 0, 1), new Date(period.year, 11, 31));
    case 'range':
      return countDays(monthKeyToDate(period.startMonthKey), endOfMonth(period.endMonthKey));
    default:
      return countDays(monthKeyToDate(getEarliestMonthKey(ctx.transactions, ctx.now)), today);
  }
}

function periodBounds(ctx: Context, period: HsebliPeriod): [Date, Date] {
  const clamp = (end: Date) => (end > ctx.now ? ctx.now : end);
  switch (period.kind) {
    case 'month':
      return [monthKeyToDate(period.monthKey), clamp(endOfMonth(period.monthKey))];
    case 'year':
      return [new Date(period.year, 0, 1), clamp(new Date(period.year, 11, 31, 23, 59, 59))];
    case 'range':
      return [monthKeyToDate(period.startMonthKey), clamp(endOfMonth(period.endMonthKey))];
    default:
      return [monthKeyToDate(getEarliestMonthKey(ctx.transactions, ctx.now)), ctx.now];
  }
}

const percentChange = (current: number, previous: number) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

function changeText(current: number, previous: number, previousLabel: string) {
  const change = percentChange(current, previous);
  if (change === null) return '';
  if (change === 0) return ` That is the same as ${previousLabel}.`;
  return ` That is ${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than ${previousLabel}, which was ${formatMoney(previous)}.`;
}

const categoryName = (ctx: Context, category: TransactionCategory) => {
  const info = categoryFor(category, ctx.customCategories);
  return `${info.emoji} ${info.label}`;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function helpResponse(): Omit<HsebliResponse, 'id'> {
  return {
    title: 'What I can do',
    body: 'I read your local transactions and calculate the answer myself, for any month or year. You can write in English, French, or Derja. Some ideas:',
    bullets: [
      { tone: 'info', text: '“How much did I spend on food in September?”' },
      { tone: 'info', text: '“Compare this month with last month” or “2025 vs 2026”' },
      { tone: 'info', text: '“Where did my money go in 2025?”' },
      { tone: 'info', text: '“Show my spending trend for the last 6 months”' },
      { tone: 'info', text: '“Will I finish the month in the green?” (forecast)' },
      { tone: 'info', text: '“Can I spend 120 TND today?”' },
      { tone: 'info', text: '“How long to save 2000 TND?”' },
      { tone: 'info', text: '“Do I have subscriptions?” · “Which day do I spend most?”' },
      { tone: 'info', text: '“Analyse my month” for automatic insights' },
    ],
    suggestedQuestions: ['Analyse my month', 'Where did my money go this year?', 'Compare to last month'],
  };
}

function summaryResponse(ctx: Context, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const summary = summarizeTransactions(periodTransactions(ctx, period), ctx.customCategories);
  const label = periodLabel(ctx, period);
  const previous = previousPeriod(period);
  const previousSummary = previous ? summarizeTransactions(periodTransactions(ctx, previous), ctx.customCategories) : undefined;

  if (summary.incomeCount + summary.expenseCount === 0) {
    return {
      title: 'Money summary',
      body: `I found no income or expenses ${label}.`,
      suggestedQuestions: ['Where did my money go this month?', 'Show my spending trend', 'What can you do?'],
    };
  }

  const top = summary.categories[0];
  return {
    title: `Summary ${label}`,
    body:
      `${capitalize(label)} you earned ${formatMoney(summary.incomeMillimes)} and spent ${formatMoney(summary.expenseMillimes)}, ` +
      `so your net is ${formatMoney(summary.netMillimes, { sign: true })}.` +
      (top ? ` Your biggest category is ${top.emoji} ${top.label} (${top.percentage}%).` : '') +
      (previousSummary && previous ? changeText(summary.expenseMillimes, previousSummary.expenseMillimes, `spending ${periodLabel(ctx, previous)}`) : ''),
    factsCard: {
      title: 'Overview',
      items: [
        { label: 'Income', value: `+${formatMoney(summary.incomeMillimes)}` },
        { label: 'Expenses', value: `-${formatMoney(summary.expenseMillimes)}` },
        { label: 'Net', value: formatMoney(summary.netMillimes, { sign: true }), isHighlight: true },
        { label: 'Savings rate', value: summary.savingsRatePercent === null ? 'No income' : `${summary.savingsRatePercent}%` },
        { label: 'Current balance', value: formatMoney(ctx.facts.totalBalanceMillimes) },
      ],
    },
    categories: summary.categories,
    suggestedQuestions: ['Analyse my month', 'Show my spending trend', 'What are my biggest expenses?'],
  };
}

function spendResponse(ctx: Context, request: Request, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const label = periodLabel(ctx, period);
  const all = periodTransactions(ctx, period).filter((transaction) => transaction.type === 'expense');
  const totalAll = sumMillimes(all);
  const previous = previousPeriod(period);

  // Free-text search inside notes, e.g. "mlawi". It wins over the category when notes match.
  if (request.searchTerm) {
    const term = request.searchTerm;
    const matches = all.filter((transaction) => hasWord(normalizeQuery(transaction.note ?? ''), term));
    if (matches.length > 0) {
      const total = sumMillimes(matches);
      return {
        title: `Spending on “${term}”`,
        body: `${capitalize(label)} you spent ${formatMoney(total)} on “${term}” in ${matches.length} ${matches.length === 1 ? 'expense' : 'expenses'} (${totalAll > 0 ? Math.round((total / totalAll) * 100) : 0}% of all spending).`,
        factsCard: {
          title: 'Matches',
          items: matches.slice(0, 5).map((transaction) => ({
            label: `${new Date(transaction.occurredAt).toLocaleDateString('en-TN', { day: 'numeric', month: 'short' })} · ${transaction.note ?? transaction.title}`,
            value: formatMoney(transaction.amountMillimes),
          })),
        },
        suggestedQuestions: ['Where did my money go this month?', 'Show my spending trend'],
      };
    }
  }

  if (request.category) {
    const name = categoryName(ctx, request.category);
    const matches = all.filter((transaction) => transaction.category === request.category);
    const total = sumMillimes(matches);
    const previousTotal = previous
      ? sumMillimes(periodTransactions(ctx, previous).filter((transaction) => transaction.type === 'expense' && transaction.category === request.category))
      : 0;
    const usual = period.kind === 'month' ? categoryMonthlyAverage(ctx.transactions, request.category, period.monthKey) : null;

    if (total === 0) {
      return {
        title: `${name} spending`,
        body: `You have no ${name} expenses ${label}.${previousTotal > 0 && previous ? ` ${capitalize(periodLabel(ctx, previous))} it was ${formatMoney(previousTotal)}.` : ''}`,
        suggestedQuestions: ['Where did my money go this month?', 'Show my spending trend'],
        memory: { category: request.category },
      };
    }

    const budget = ctx.categoryBudgets.find((item) => item.category === request.category && (!item.monthKey || (period.kind === 'month' && item.monthKey === period.monthKey)));
    return {
      title: `${name} spending`,
      body:
        `${capitalize(label)} you spent ${formatMoney(total)} on ${name} in ${matches.length} ${matches.length === 1 ? 'expense' : 'expenses'}, ` +
        `${totalAll > 0 ? Math.round((total / totalAll) * 100) : 0}% of all your spending.` +
        (previous ? changeText(total, previousTotal, periodLabel(ctx, previous)) : ''),
      factsCard: {
        title: `${name} analytics`,
        items: [
          { label: 'Total', value: formatMoney(total), isHighlight: true },
          { label: 'Share of spending', value: `${totalAll > 0 ? Math.round((total / totalAll) * 100) : 0}%` },
          { label: 'Average per expense', value: formatMoney(Math.round(total / matches.length)) },
          ...(usual !== null ? [{ label: 'Your usual month (3-month avg)', value: formatMoney(usual) }] : []),
          ...(budget && period.kind === 'month'
            ? [{ label: 'Budget used', value: `${Math.round((total / budget.amountMillimes) * 100)}% of ${formatMoney(budget.amountMillimes)}` }]
            : []),
        ],
      },
      suggestedQuestions: [`Show my ${categoryFor(request.category, ctx.customCategories).label.toLowerCase()} trend`, 'Compare to last month', 'Analyse my month'],
      memory: { category: request.category },
    };
  }

  // Total spending for the period.
  const previousTotal = previous ? sumMillimes(periodTransactions(ctx, previous).filter((transaction) => transaction.type === 'expense')) : 0;
  const days = elapsedDays(ctx, period);
  const categories = buildCategoryFacts(all, ctx.customCategories);
  return {
    title: `Spending ${label}`,
    body:
      totalAll === 0
        ? `You have no expenses ${label}.`
        : `${capitalize(label)} you spent ${formatMoney(totalAll)} in ${all.length} ${all.length === 1 ? 'expense' : 'expenses'}${days > 0 ? `, about ${formatMoney(Math.round(totalAll / days))} per day` : ''}.` +
          (previous ? changeText(totalAll, previousTotal, periodLabel(ctx, previous)) : ''),
    categories,
    suggestedQuestions: ['What are my biggest expenses?', 'Analyse my month', 'Show my spending trend'],
  };
}

function breakdownResponse(ctx: Context, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const summary = summarizeTransactions(periodTransactions(ctx, period), ctx.customCategories);
  const label = periodLabel(ctx, period);
  if (summary.expenseMillimes === 0) {
    return { title: 'Spending breakdown', body: `You have no expenses ${label}.`, suggestedQuestions: ['Show my spending trend', 'What can you do?'] };
  }
  const top = summary.categories[0];
  const topThreeShare = Math.round(summary.categories.slice(0, 3).reduce((sum, category) => sum + category.percentage, 0));
  return {
    title: `Where your money went ${label}`,
    body:
      `${capitalize(label)} you spent ${formatMoney(summary.expenseMillimes)} across ${summary.categories.length} ${summary.categories.length === 1 ? 'category' : 'categories'}. ` +
      `${top.emoji} ${top.label} is #1 with ${formatMoney(top.amountMillimes)} (${top.percentage}%).` +
      (summary.categories.length > 3 ? ` Your top 3 categories make ${topThreeShare}% of spending.` : ''),
    categories: summary.categories,
    factsCard: summary.largestExpense
      ? {
          title: 'Highlights',
          items: [
            { label: 'Total spent', value: formatMoney(summary.expenseMillimes), isHighlight: true },
            { label: 'Largest expense', value: `${summary.largestExpense.title} · ${formatMoney(summary.largestExpense.amountMillimes)}` },
            { label: 'Number of expenses', value: String(summary.expenseCount) },
          ],
        }
      : undefined,
    suggestedQuestions: [`How much did I spend on ${top.label.toLowerCase()}?`, 'What are my biggest expenses?', 'Compare to last month'],
  };
}

function incomeResponse(ctx: Context, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const summary = summarizeTransactions(periodTransactions(ctx, period), ctx.customCategories);
  const label = periodLabel(ctx, period);
  const previous = previousPeriod(period);
  const previousIncome = previous ? summarizeTransactions(periodTransactions(ctx, previous)).incomeMillimes : 0;
  const pending = period.kind === 'month' && period.monthKey === ctx.currentMonthKey ? forecastMonth(ctx.transactions, ctx.salaryRule, ctx.now).pendingSalaryMillimes : 0;

  return {
    title: `Income ${label}`,
    body:
      (summary.incomeMillimes === 0 ? `No confirmed income ${label}.` : `${capitalize(label)} you received ${formatMoney(summary.incomeMillimes)} in ${summary.incomeCount} ${summary.incomeCount === 1 ? 'payment' : 'payments'}.`) +
      (previous && summary.incomeMillimes > 0 ? changeText(summary.incomeMillimes, previousIncome, periodLabel(ctx, previous)) : '') +
      (pending > 0 ? ` Your expected salary of ${formatMoney(pending)} is not confirmed yet, so it is not in your balance.` : ''),
    factsCard: summary.incomeCategories.length > 0
      ? { title: 'Income sources', items: summary.incomeCategories.map((source) => ({ label: `${source.emoji} ${source.label}`, value: formatMoney(source.amountMillimes) })) }
      : undefined,
    suggestedQuestions: ['How much did I save this month?', 'Show my spending trend'],
  };
}

function savingsResponse(ctx: Context, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const summary = summarizeTransactions(periodTransactions(ctx, period), ctx.customCategories);
  const label = periodLabel(ctx, period);
  const bars = period.kind === 'month' ? undefined : monthBars(ctx, period, 'net');

  let body: string;
  if (summary.incomeMillimes === 0 && summary.expenseMillimes === 0) body = `I found no income or expenses ${label}.`;
  else if (summary.incomeMillimes === 0) body = `${capitalize(label)} you have no confirmed income, and you spent ${formatMoney(summary.expenseMillimes)}.`;
  else if (summary.netMillimes >= 0) body = `${capitalize(label)} you saved ${formatMoney(summary.netMillimes)}, which is ${summary.savingsRatePercent}% of your income.`;
  else body = `${capitalize(label)} you spent ${formatMoney(Math.abs(summary.netMillimes))} more than you earned.`;

  return {
    title: `Savings ${label}`,
    body,
    factsCard: {
      title: 'Cashflow',
      items: [
        { label: 'Income', value: `+${formatMoney(summary.incomeMillimes)}` },
        { label: 'Expenses', value: `-${formatMoney(summary.expenseMillimes)}` },
        { label: 'Net savings', value: formatMoney(summary.netMillimes, { sign: true }), isHighlight: true },
        { label: 'Savings rate', value: summary.savingsRatePercent === null ? 'No income' : `${summary.savingsRatePercent}%` },
      ],
    },
    bars,
    suggestedQuestions: ['How long to save 1000 TND?', 'Where did my money go?', 'Analyse my month'],
  };
}

function largestResponse(ctx: Context, request: Request, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const label = periodLabel(ctx, period);
  const expenses = periodTransactions(ctx, period)
    .filter((transaction) => transaction.type === 'expense' && (!request.category || transaction.category === request.category))
    .sort((a, b) => b.amountMillimes - a.amountMillimes);
  if (expenses.length === 0) {
    return { title: 'Biggest expenses', body: `You have no expenses ${label}.`, suggestedQuestions: ['Show my spending trend'] };
  }
  const top = expenses.slice(0, 5);
  const total = sumMillimes(expenses);
  const topTotal = sumMillimes(top);
  return {
    title: `Biggest expenses ${label}`,
    body: `Your ${top.length} biggest expenses ${label} add up to ${formatMoney(topTotal)}, ${Math.round((topTotal / total) * 100)}% of the ${formatMoney(total)} you spent.`,
    factsCard: {
      title: 'Top expenses',
      items: top.map((transaction, index) => ({
        label: `${index + 1}. ${transaction.note ? `${transaction.title} · ${transaction.note}` : transaction.title} (${new Date(transaction.occurredAt).toLocaleDateString('en-TN', { day: 'numeric', month: 'short' })})`,
        value: formatMoney(transaction.amountMillimes),
        isHighlight: index === 0,
      })),
    },
    suggestedQuestions: ['Where did my money go?', 'Do I have subscriptions?'],
  };
}

function resolveComparison(ctx: Context, request: Request): [HsebliPeriod, HsebliPeriod] {
  if (request.period && request.comparePeriod) return [request.period, request.comparePeriod];
  const period = request.period ?? currentMonthPeriod(ctx);
  // "Compare to last month" means this month against last month.
  if (period.kind === 'month' && period.monthKey === shiftMonthKey(ctx.currentMonthKey, -1)) return [currentMonthPeriod(ctx), period];
  if (period.kind === 'year' && period.year === ctx.now.getFullYear() - 1) return [{ kind: 'year', year: ctx.now.getFullYear() }, period];
  return [period, previousPeriod(period) ?? currentMonthPeriod(ctx)];
}

function compareResponse(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const [first, second] = resolveComparison(ctx, request);
  const firstTx = periodTransactions(ctx, first).filter((transaction) => !request.category || transaction.category === request.category);
  const secondTx = periodTransactions(ctx, second).filter((transaction) => !request.category || transaction.category === request.category);
  const a = summarizeTransactions(firstTx, ctx.customCategories);
  const b = summarizeTransactions(secondTx, ctx.customCategories);
  const firstLabel = periodLabel(ctx, first);
  const secondLabel = periodLabel(ctx, second);
  const subject = request.category ? `${categoryName(ctx, request.category)} spending` : 'spending';
  const diff = a.expenseMillimes - b.expenseMillimes;
  const change = percentChange(a.expenseMillimes, b.expenseMillimes);
  const isPartial = first.kind === 'month' && first.monthKey === ctx.currentMonthKey;

  let body: string;
  if (a.expenseMillimes === 0 && b.expenseMillimes === 0) body = `There is no ${subject} ${firstLabel} or ${secondLabel}.`;
  else if (b.expenseMillimes === 0) body = `Your ${subject} ${firstLabel} is ${formatMoney(a.expenseMillimes)}. There is nothing recorded ${secondLabel} to compare with.`;
  else
    body =
      `Your ${subject} ${firstLabel} is ${formatMoney(a.expenseMillimes)} versus ${formatMoney(b.expenseMillimes)} ${secondLabel}: ` +
      `${diff === 0 ? 'exactly the same' : `${formatMoney(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}${change !== null ? ` (${diff > 0 ? '+' : '-'}${Math.abs(change)}%)` : ''}`}.` +
      (isPartial ? ` Note: this month is not finished yet (day ${ctx.now.getDate()}).` : '');

  // Which categories moved the most.
  const bullets: HsebliBullet[] = [];
  if (!request.category) {
    const movers = new Map<TransactionCategory, number>();
    for (const category of a.categories) movers.set(category.category, category.amountMillimes);
    for (const category of b.categories) movers.set(category.category, (movers.get(category.category) ?? 0) - category.amountMillimes);
    const sorted = Array.from(movers.entries()).filter(([, value]) => Math.abs(value) >= 1000).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 3);
    for (const [category, value] of sorted) {
      bullets.push({ tone: value > 0 ? 'warning' : 'good', text: `${categoryName(ctx, category)}: ${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value))}` });
    }
  }

  return {
    title: 'Comparison',
    body,
    factsCard: {
      title: `${capitalize(firstLabel)} vs ${secondLabel}`,
      items: [
        { label: `Spent ${firstLabel}`, value: formatMoney(a.expenseMillimes), isHighlight: true },
        { label: `Spent ${secondLabel}`, value: formatMoney(b.expenseMillimes) },
        ...(!request.category
          ? [
              { label: `Income ${firstLabel}`, value: formatMoney(a.incomeMillimes) },
              { label: `Income ${secondLabel}`, value: formatMoney(b.incomeMillimes) },
              { label: `Net ${firstLabel}`, value: formatMoney(a.netMillimes, { sign: true }) },
              { label: `Net ${secondLabel}`, value: formatMoney(b.netMillimes, { sign: true }) },
            ]
          : []),
      ],
    },
    bullets: bullets.length > 0 ? bullets : undefined,
    suggestedQuestions: ['Show my spending trend', 'Analyse my month', 'Where did my money go?'],
  };
}

function monthBars(ctx: Context, period: HsebliPeriod, measure: 'expense' | 'net', category?: TransactionCategory): HsebliBar[] {
  let start: string;
  let end: string;
  if (period.kind === 'year') {
    start = `${period.year}-01`;
    end = period.year === ctx.now.getFullYear() ? ctx.currentMonthKey : `${period.year}-12`;
  } else if (period.kind === 'range') {
    start = period.startMonthKey;
    end = period.endMonthKey;
  } else if (period.kind === 'all') {
    end = ctx.currentMonthKey;
    start = getEarliestMonthKey(ctx.transactions, ctx.now);
    if (monthKeyDiff(start, end) > 11) start = shiftMonthKey(end, -11);
  } else {
    end = period.monthKey;
    start = shiftMonthKey(end, -5);
  }
  const source = category ? ctx.transactions.filter((transaction) => transaction.category === category) : ctx.transactions;
  return getMonthlySeries(source, start, end).map((point) => ({
    label: formatShortMonth(point.monthKey).slice(0, 3),
    valueMillimes: measure === 'net' ? point.netMillimes : point.expenseMillimes,
    tone: measure === 'net' ? (point.netMillimes >= 0 ? 'income' : 'expense') : 'expense',
  }));
}

function trendResponse(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const period: HsebliPeriod =
    request.period && request.period.kind !== 'month'
      ? request.period
      : { kind: 'range', startMonthKey: shiftMonthKey(request.period?.kind === 'month' ? request.period.monthKey : ctx.currentMonthKey, -5), endMonthKey: request.period?.kind === 'month' ? request.period.monthKey : ctx.currentMonthKey };
  const bars = monthBars(ctx, period, 'expense', request.category);
  const subject = request.category ? `${categoryName(ctx, request.category)} spending` : 'spending';
  const completed = bars.slice(0, -1);
  const withData = bars.filter((bar) => bar.valueMillimes > 0);

  if (withData.length === 0) {
    return { title: 'Spending trend', body: `I found no ${subject} ${periodLabel(ctx, period)}.`, suggestedQuestions: ['What can you do?'] };
  }

  const average = Math.round(withData.reduce((sum, bar) => sum + bar.valueMillimes, 0) / withData.length);
  const highest = withData.reduce((best, bar) => (bar.valueMillimes > best.valueMillimes ? bar : best));
  const lowest = withData.reduce((best, bar) => (bar.valueMillimes < best.valueMillimes ? bar : best));
  // Direction: compare the last 3 complete months with the 3 before them.
  const recent = completed.slice(-3).map((bar) => bar.valueMillimes);
  const older = completed.slice(-6, -3).map((bar) => bar.valueMillimes);
  const avg = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  const direction = older.length >= 2 && avg(older) > 0 ? Math.round(((avg(recent) - avg(older)) / avg(older)) * 100) : null;

  return {
    title: `${capitalize(subject)} trend`,
    body:
      `${capitalize(periodLabel(ctx, period))} your ${subject} averaged ${formatMoney(average)} per month (months with data). ` +
      `Highest: ${highest.label} (${formatMoney(highest.valueMillimes)}), lowest: ${lowest.label} (${formatMoney(lowest.valueMillimes)}).` +
      (direction === null
        ? ''
        : Math.abs(direction) < 5
        ? ' Your recent months are stable.'
        : ` Your recent months are ${Math.abs(direction)}% ${direction > 0 ? 'higher' : 'lower'} than the months before.`),
    bars,
    suggestedQuestions: ['Compare to last month', 'Where did my money go this year?', 'Will I stay within my income this month?'],
    memory: { category: request.category },
  };
}

function forecastResponse(ctx: Context): Omit<HsebliResponse, 'id'> {
  const forecast = forecastMonth(ctx.transactions, ctx.salaryRule, ctx.now);
  const daysLeft = forecast.daysInMonth - forecast.daysElapsed;
  const expectedIncome = forecast.incomeSoFarMillimes + forecast.pendingSalaryMillimes;
  const vsLast = percentChange(forecast.projectedExpenseMillimes, forecast.lastMonthExpenseMillimes);

  return {
    title: 'End of month forecast',
    body:
      `You spent ${formatMoney(forecast.spentSoFarMillimes)} in ${forecast.daysElapsed} days (${formatMoney(forecast.dailyAverageMillimes)} per day). ` +
      `If you keep this pace for the ${daysLeft} days left${forecast.fixedPendingMillimes > 0 ? ` and pay your usual bills (${formatMoney(forecast.fixedPendingMillimes)})` : ''}, you will spend about ${formatMoney(forecast.projectedExpenseMillimes)} this month.` +
      (vsLast !== null ? ` That is ${Math.abs(vsLast)}% ${vsLast >= 0 ? 'more' : 'less'} than last month (${formatMoney(forecast.lastMonthExpenseMillimes)}).` : '') +
      (expectedIncome > 0
        ? forecast.projectedNetMillimes >= 0
          ? ` You would finish about ${formatMoney(forecast.projectedNetMillimes)} in the green.`
          : ` You would finish about ${formatMoney(Math.abs(forecast.projectedNetMillimes))} above your income.`
        : ' I have no income for this month to compare with.') +
      ' This is a simple estimate, not a promise.',
    factsCard: {
      title: 'Forecast (estimate)',
      items: [
        { label: 'Spent so far', value: formatMoney(forecast.spentSoFarMillimes) },
        { label: 'Daily average (without bills)', value: formatMoney(forecast.variableDailyAverageMillimes) },
        ...(forecast.fixedPendingMillimes > 0 ? [{ label: 'Usual bills still to pay', value: formatMoney(forecast.fixedPendingMillimes) }] : []),
        { label: 'Projected month spending', value: formatMoney(forecast.projectedExpenseMillimes), isHighlight: true },
        { label: 'Income so far', value: formatMoney(forecast.incomeSoFarMillimes) },
        ...(forecast.pendingSalaryMillimes > 0 ? [{ label: 'Expected salary (not confirmed)', value: formatMoney(forecast.pendingSalaryMillimes) }] : []),
        { label: 'Projected net', value: formatMoney(forecast.projectedNetMillimes, { sign: true }) },
      ],
    },
    suggestedQuestions: ['Can I spend 50 TND today?', 'Analyse my month', 'Where did my money go this month?'],
  };
}

function affordResponse(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const amount = request.amountMillimes;
  if (!amount) {
    return {
      title: 'Spending check',
      body: 'How much do you want to spend? Tell me the amount, for example “Can I spend 80 TND?”',
      suggestedQuestions: ['Can I spend 30 TND today?', 'Can I spend 100 TND?', 'Can I spend 300 TND?'],
    };
  }
  const balance = ctx.facts.totalBalanceMillimes;
  const remaining = balance - amount;
  const forecast = forecastMonth(ctx.transactions, ctx.salaryRule, ctx.now);

  if (remaining < 0) {
    return {
      title: 'Spending check',
      body: `No. ${formatMoney(amount)} is more than your total balance of ${formatMoney(balance)}. You would be short by ${formatMoney(Math.abs(remaining))}.`,
      factsCard: {
        title: 'Cashflow impact',
        items: [
          { label: 'Current balance', value: formatMoney(balance) },
          { label: 'Requested spend', value: formatMoney(amount), isHighlight: true },
          { label: 'Shortfall', value: formatMoney(Math.abs(remaining)) },
        ],
      },
      suggestedQuestions: ['What are my account balances?', 'Where did my money go this month?'],
    };
  }

  if (!ctx.salaryRule) {
    const runway = forecast.variableDailyAverageMillimes > 0 ? Math.floor(remaining / forecast.variableDailyAverageMillimes) : null;
    return {
      title: 'Spending check',
      body:
        `You have enough: after ${formatMoney(amount)} you would keep ${formatMoney(remaining)}.` +
        (runway !== null ? ` At your current pace (${formatMoney(forecast.variableDailyAverageMillimes)} per day) that lasts about ${runway} days.` : '') +
        ' Set your expected salary so I can check it against your next payday.',
      factsCard: {
        title: 'Cashflow impact',
        items: [
          { label: 'Balance now', value: formatMoney(balance) },
          { label: 'Balance after', value: formatMoney(remaining), isHighlight: true },
        ],
      },
      suggestedQuestions: ['Will I stay within my income this month?', 'Where did my money go this month?'],
    };
  }

  const days = Math.max(1, ctx.facts.daysUntilPayday);
  const newDailyRate = Math.floor(remaining / days);
  const fitsToday = amount <= ctx.facts.safeDailySpendRateMillimes;
  const verdict = fitsToday
    ? 'Yes, it fits inside your safe daily pace.'
    : newDailyRate >= forecast.variableDailyAverageMillimes
    ? 'Yes, but it is more than your safe pace for one day.'
    : 'You can, but it will be tight.';

  return {
    title: 'Spending check',
    body:
      `${verdict} After ${formatMoney(amount)} you would have ${formatMoney(remaining)} for ${days} ${days === 1 ? 'day' : 'days'} until payday, ` +
      `so ${formatMoney(newDailyRate)} per day.` +
      (forecast.variableDailyAverageMillimes > 0
        ? ` Without bills you usually spend ${formatMoney(forecast.variableDailyAverageMillimes)} per day this month${newDailyRate < forecast.variableDailyAverageMillimes ? ', so you would need to slow down' : ''}.`
        : ''),
    factsCard: {
      title: 'Cashflow impact',
      items: [
        { label: 'Balance now', value: formatMoney(balance) },
        { label: 'Balance after', value: formatMoney(remaining) },
        { label: 'Safe pace now', value: `${formatMoney(ctx.facts.safeDailySpendRateMillimes)} / day` },
        { label: 'Safe pace after', value: `${formatMoney(newDailyRate)} / day`, isHighlight: true },
        { label: 'Days until salary', value: String(ctx.facts.daysUntilPayday) },
      ],
    },
    suggestedQuestions: ['Will I stay within my income this month?', 'What are my account balances?'],
  };
}

function balanceResponse(ctx: Context): Omit<HsebliResponse, 'id'> {
  const accounts = [...ctx.facts.accountBreakdown].sort((a, b) => b.balanceMillimes - a.balanceMillimes);
  const negative = accounts.filter((account) => account.balanceMillimes < 0);
  return {
    title: 'Account balances',
    body:
      `You have ${formatMoney(ctx.facts.totalBalanceMillimes)} in total across ${accounts.length} accounts.` +
      (accounts[0] && ctx.facts.totalBalanceMillimes > 0 ? ` Most of it is in ${accounts[0].emoji} ${accounts[0].name}.` : '') +
      (negative.length > 0 ? ` ${negative.map((account) => account.name).join(', ')} ${negative.length === 1 ? 'is' : 'are'} below zero; check the starting balance or a missing income.` : ''),
    factsCard: {
      title: 'Account breakdown',
      items: accounts.map((account) => ({ label: `${account.emoji} ${account.name}`, value: formatMoney(account.balanceMillimes) })),
    },
    suggestedQuestions: ['Can I spend 50 TND today?', 'Where did my money go this month?'],
  };
}

function budgetResponse(ctx: Context): Omit<HsebliResponse, 'id'> {
  const budgets = ctx.categoryBudgets.filter((budget) => !budget.monthKey || budget.monthKey === ctx.currentMonthKey);
  if (budgets.length === 0) {
    return {
      title: 'Budgets',
      body: 'You have no category budgets yet. Use “Set budget” above to add a monthly limit, for example for Food or Transport.',
      suggestedQuestions: ['Where did my money go this month?', 'Show my spending trend'],
    };
  }
  const forecast = forecastMonth(ctx.transactions, ctx.salaryRule, ctx.now);
  const ratio = forecast.daysElapsed / forecast.daysInMonth;
  const monthExpenses = transactionsInMonth(ctx.transactions, ctx.currentMonthKey).filter((transaction) => transaction.type === 'expense');
  const bullets: HsebliBullet[] = budgets.map((budget) => {
    const spent = sumMillimes(monthExpenses.filter((transaction) => transaction.category === budget.category));
    const percent = Math.round((spent / budget.amountMillimes) * 100);
    const projected = ratio > 0 ? Math.round(spent / ratio) : spent;
    const name = categoryName(ctx, budget.category);
    if (spent > budget.amountMillimes) return { tone: 'warning', text: `${name}: over by ${formatMoney(spent - budget.amountMillimes)} (${percent}%).` };
    if (projected > budget.amountMillimes) return { tone: 'warning', text: `${name}: ${percent}% used. At this pace you will reach about ${formatMoney(projected)} of ${formatMoney(budget.amountMillimes)}.` };
    return { tone: 'good', text: `${name}: ${percent}% used, ${formatMoney(budget.amountMillimes - spent)} left. On track.` };
  });
  const atRisk = bullets.filter((bullet) => bullet.tone === 'warning').length;
  return {
    title: 'Budget check',
    body: atRisk === 0 ? `All ${budgets.length} budgets are on track for this month.` : `${atRisk} of ${budgets.length} budgets need attention this month.`,
    bullets,
    suggestedQuestions: ['Analyse my month', 'Will I stay within my income this month?'],
  };
}

function insightsResponse(ctx: Context, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  if (period.kind !== 'month') {
    // For a year or range, give the summary plus the month-by-month view.
    const summary = summaryResponse(ctx, period);
    return { ...summary, title: `Analysis ${periodLabel(ctx, period)}`, bars: monthBars(ctx, period, 'expense') };
  }
  const insights = generateInsights({
    transactions: ctx.transactions,
    monthKey: period.monthKey,
    categoryBudgets: ctx.categoryBudgets,
    customCategories: ctx.customCategories,
    salaryRule: ctx.salaryRule,
    now: ctx.now,
  });
  const warnings = insights.filter((insight) => insight.tone === 'warning').length;
  return {
    title: `Analysis ${periodLabel(ctx, period)}`,
    body:
      insights.length === 0
        ? 'Nothing unusual. Your spending looks normal compared to your previous months.'
        : warnings > 0
        ? `I found ${insights.length} things worth knowing, ${warnings} of them need attention:`
        : `I found ${insights.length} things worth knowing. Nothing worrying:`,
    bullets: insights,
    suggestedQuestions: ['Will I stay within my income this month?', 'Do I have subscriptions?', 'Show my spending trend'],
  };
}

function recurringResponse(ctx: Context): Omit<HsebliResponse, 'id'> {
  const recurring = detectRecurringExpenses(ctx.transactions, ctx.customCategories, ctx.now);
  if (recurring.length === 0) {
    return {
      title: 'Recurring expenses',
      body: 'I found no expense that repeats with a similar amount in at least 3 of the last 6 months. Adding the same note (for example “Internet”) helps me detect them.',
      suggestedQuestions: ['What are my biggest expenses?', 'Show my spending trend'],
    };
  }
  const monthly = recurring.reduce((sum, item) => sum + item.averageMillimes, 0);
  return {
    title: 'Recurring expenses',
    body: `I found ${recurring.length} repeating ${recurring.length === 1 ? 'expense' : 'expenses'} costing about ${formatMoney(monthly)} per month, or ${formatMoney(monthly * 12)} per year.`,
    factsCard: {
      title: 'Repeating every month',
      items: recurring.slice(0, 6).map((item) => ({ label: `${item.label} (${item.monthCount} months)`, value: `${formatMoney(item.averageMillimes)} / mo` })),
    },
    suggestedQuestions: ['Where did my money go this month?', 'How long to save 1000 TND?'],
  };
}

function weekdayResponse(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const period: HsebliPeriod = request.period ?? { kind: 'range', startMonthKey: shiftMonthKey(ctx.currentMonthKey, -2), endMonthKey: ctx.currentMonthKey };
  const [start, end] = periodBounds(ctx, period);
  const pattern = analyzeWeekdays(periodTransactions(ctx, period), start, end);
  if (!pattern) {
    return { title: 'Spending by weekday', body: `I found no expenses ${periodLabel(ctx, period)}.`, suggestedQuestions: ['What can you do?'] };
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return {
    title: 'Spending by weekday',
    body:
      `${capitalize(periodLabel(ctx, period))} you spend the most on ${weekdayNames[pattern.topWeekday]}s (${formatMoney(pattern.totalsMillimes[pattern.topWeekday])} in total). ` +
      `On average a weekend day costs you ${formatMoney(pattern.weekendDailyAverageMillimes)} and a weekday ${formatMoney(pattern.weekdayDailyAverageMillimes)}.`,
    bars: order.map((day) => ({ label: weekdayNames[day].slice(0, 3), valueMillimes: pattern.totalsMillimes[day], tone: 'expense' })),
    suggestedQuestions: ['Analyse my month', 'Show my spending trend'],
  };
}

function averageResponse(ctx: Context, request: Request, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const expenses = periodTransactions(ctx, period).filter((transaction) => transaction.type === 'expense' && (!request.category || transaction.category === request.category));
  const total = sumMillimes(expenses);
  const days = Math.max(1, elapsedDays(ctx, period));
  const months = period.kind === 'month' ? 1 : new Set(expenses.map((transaction) => getLocalMonthKey(new Date(transaction.occurredAt)))).size;
  const subject = request.category ? `${categoryName(ctx, request.category)} spending` : 'spending';
  if (total === 0) return { title: 'Averages', body: `No ${subject} ${periodLabel(ctx, period)}.`, suggestedQuestions: ['Show my spending trend'] };
  return {
    title: `Average ${subject}`,
    body: `${capitalize(periodLabel(ctx, period))} your ${subject} is about ${formatMoney(Math.round(total / days))} per day${months > 1 ? ` and ${formatMoney(Math.round(total / months))} per month` : ''}.`,
    factsCard: {
      title: 'Averages',
      items: [
        { label: 'Per day', value: formatMoney(Math.round(total / days)), isHighlight: true },
        ...(months > 1 ? [{ label: 'Per month (months with spending)', value: formatMoney(Math.round(total / months)) }] : []),
        { label: 'Per expense', value: formatMoney(Math.round(total / expenses.length)) },
        { label: 'Days counted', value: String(days) },
      ],
    },
    suggestedQuestions: ['Show my spending trend', 'Which day do I spend most?'],
    memory: { category: request.category },
  };
}

function goalResponse(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const target = request.amountMillimes;
  if (!target) {
    return {
      title: 'Savings goal',
      body: 'Tell me the amount you want to save, for example “How long to save 2000 TND?”',
      suggestedQuestions: ['How long to save 1000 TND?', 'How long to save 5000 TND?'],
    };
  }
  const { averageMillimes, monthsUsed } = averageMonthlySavings(ctx.transactions, ctx.now);
  if (monthsUsed === 0) {
    return { title: 'Savings goal', body: 'I need at least one complete month of income and expenses to estimate how fast you save.', suggestedQuestions: ['What can you do?'] };
  }
  if (averageMillimes <= 0) {
    return {
      title: 'Savings goal',
      body: `In your last ${monthsUsed} complete ${monthsUsed === 1 ? 'month' : 'months'} you spent more than you earned (average ${formatMoney(averageMillimes, { sign: true })} per month), so at this pace you would not reach ${formatMoney(target)}.`,
      suggestedQuestions: ['Where did my money go this month?', 'Do I have subscriptions?'],
    };
  }
  const months = Math.ceil(target / averageMillimes);
  const top = ctx.facts.sortedCategories[0];
  const faster = top ? Math.ceil(target / (averageMillimes + Math.round(top.amountMillimes * 0.2))) : null;
  return {
    title: 'Savings goal',
    body:
      `You save about ${formatMoney(averageMillimes)} per month (average of your last ${monthsUsed} complete months). ` +
      `At this pace you would reach ${formatMoney(target)} in about ${months} ${months === 1 ? 'month' : 'months'}.` +
      (top && faster !== null && faster < months ? ` If you spent 20% less on ${top.label}, it would take about ${faster} months.` : ''),
    factsCard: {
      title: 'Goal estimate',
      items: [
        { label: 'Goal', value: formatMoney(target) },
        { label: 'Average monthly savings', value: formatMoney(averageMillimes) },
        { label: 'Estimated time', value: `${months} ${months === 1 ? 'month' : 'months'}`, isHighlight: true },
      ],
    },
    suggestedQuestions: ['How much did I save this month?', 'Do I have subscriptions?'],
  };
}

function countResponse(ctx: Context, request: Request, period: HsebliPeriod): Omit<HsebliResponse, 'id'> {
  const transactions = periodTransactions(ctx, period).filter((transaction) => transaction.type !== 'transfer' && (!request.category || transaction.category === request.category));
  const expenses = transactions.filter((transaction) => transaction.type === 'expense').length;
  return {
    title: 'Transaction count',
    body: `${capitalize(periodLabel(ctx, period))} you recorded ${transactions.length} ${request.category ? `${categoryName(ctx, request.category)} ` : ''}transactions: ${expenses} expenses and ${transactions.length - expenses} incomes.`,
    suggestedQuestions: ['Where did my money go?', 'What are my biggest expenses?'],
  };
}

function greetingResponse(ctx: Context): Omit<HsebliResponse, 'id'> {
  return {
    title: 'Aslema! 👋',
    body: `Ahla bik. You have ${formatMoney(ctx.facts.totalBalanceMillimes)} right now and you spent ${formatMoney(ctx.facts.thisMonthExpenseMillimes)} this month. What do you want to know?`,
    suggestedQuestions: ['Analyse my month', 'Where did my money go this year?', 'What can you do?'],
  };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function buildContext(data: HsebliData): Context {
  const now = data.now ?? new Date();
  return {
    transactions: data.transactions,
    accounts: data.accounts,
    accountBalances: data.accountBalances,
    salaryRule: data.salaryRule,
    categoryBudgets: data.categoryBudgets,
    customCategories: data.customCategories,
    now,
    currentMonthKey: getLocalMonthKey(now),
    facts: extractFinancialFacts(data.transactions, data.accounts, data.accountBalances, data.salaryRule, data.categoryBudgets, data.customCategories, now),
  };
}

const categoryIntents: HsebliIntent[] = ['spend', 'trend', 'largest', 'count', 'compare', 'average'];

/** Builds the full request, using memory for follow-ups such as "and last month?" or "what about food?". */
function resolveRequest(query: string, ctx: Context, memory?: HsebliMemory): Request | null {
  const parsed = parseHsebliQuery(query, ctx.customCategories, ctx.now);
  const isFollowUp = /^(?:and|what about|how about|same for|et|et pour|w|wel|ou|bon)\b/.test(parsed.normalized);
  let intent = parsed.intent;
  let period = parsed.period;
  let category = parsed.category;

  if (!intent && memory?.intent && (parsed.period || parsed.category || isFollowUp)) intent = memory.intent;
  if (isFollowUp || (!parsed.intent && memory?.intent)) {
    period = period ?? memory?.period;
    if (intent && categoryIntents.includes(intent)) category = category ?? memory?.category;
  }
  if (!intent) {
    if (category) intent = 'spend';
    else if (period) intent = 'summary';
    else return null;
  }
  return { intent, period, comparePeriod: parsed.comparePeriod, category, amountMillimes: parsed.amountMillimes, searchTerm: parsed.searchTerm };
}

function answer(ctx: Context, request: Request): Omit<HsebliResponse, 'id'> {
  const period = request.period ?? currentMonthPeriod(ctx);
  switch (request.intent) {
    case 'help': return helpResponse();
    case 'greeting': return greetingResponse(ctx);
    case 'afford': return affordResponse(ctx, request);
    case 'balance': return balanceResponse(ctx);
    case 'compare': return compareResponse(ctx, request);
    case 'trend': return trendResponse(ctx, request);
    case 'breakdown': return breakdownResponse(ctx, period);
    case 'spend': return spendResponse(ctx, request, period);
    case 'income': return incomeResponse(ctx, period);
    case 'savings': return savingsResponse(ctx, period);
    case 'largest': return largestResponse(ctx, request, period);
    case 'forecast': return forecastResponse(ctx);
    case 'budget': return budgetResponse(ctx);
    case 'insights': return insightsResponse(ctx, period);
    case 'recurring': return recurringResponse(ctx);
    case 'weekday': return weekdayResponse(ctx, request);
    case 'average': return averageResponse(ctx, request, period);
    case 'goal': return goalResponse(ctx, request);
    case 'count': return countResponse(ctx, request, period);
    default: return summaryResponse(ctx, period);
  }
}

export function processHsebliQuery(query: string, data: HsebliData, memory?: HsebliMemory): HsebliResponse {
  const ctx = buildContext(data);
  const id = `ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const request = resolveRequest(query, ctx, memory);

  if (!request) {
    return {
      id,
      title: 'I’m not sure I understood',
      body: 'I could not match your question to your data. Try asking about a month, a year, a category, or an amount. Here is a quick snapshot meanwhile:',
      factsCard: {
        title: 'Snapshot',
        items: [
          { label: 'Balance', value: formatMoney(ctx.facts.totalBalanceMillimes), isHighlight: true },
          { label: 'Spent this month', value: formatMoney(ctx.facts.thisMonthExpenseMillimes) },
          { label: 'Earned this month', value: formatMoney(ctx.facts.thisMonthIncomeMillimes) },
        ],
      },
      suggestedQuestions: ['What can you do?', 'Analyse my month', 'Where did my money go this year?'],
      memory,
    };
  }

  const response = answer(ctx, request);
  return {
    id,
    ...response,
    memory: {
      intent: request.intent,
      period: request.period,
      category: response.memory?.category ?? (categoryIntents.includes(request.intent) ? request.category : undefined),
    },
  };
}

/** First message on the assistant screen. */
export function buildWelcomeResponse(data: HsebliData): HsebliResponse {
  const ctx = buildContext(data);
  const insights = generateInsights({
    transactions: ctx.transactions,
    monthKey: ctx.currentMonthKey,
    categoryBudgets: ctx.categoryBudgets,
    customCategories: ctx.customCategories,
    salaryRule: ctx.salaryRule,
    now: ctx.now,
  }).slice(0, 3);
  return {
    id: 'resp_welcome',
    title: 'Hsebli money companion',
    body: 'Aslama! I’m Hsebli. I analyse your money privately on this phone, for any month or year. Ask me in English, French, or Derja.',
    factsCard: {
      title: 'Wallet status',
      items: [
        { label: 'Total balance', value: formatMoney(ctx.facts.totalBalanceMillimes), isHighlight: true },
        { label: 'Spent this month', value: formatMoney(ctx.facts.thisMonthExpenseMillimes) },
        { label: 'Daily safe pace', value: ctx.facts.safeDailySpendRateMillimes > 0 ? `${formatMoney(ctx.facts.safeDailySpendRateMillimes)} / day` : 'Configure salary' },
      ],
    },
    bullets: ctx.transactions.length > 0 ? insights : undefined,
    suggestedQuestions: ['Analyse my month', 'What can you do?', 'Compare to last month'],
  };
}
