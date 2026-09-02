import { formatMoney } from './format-money';
import type { FinancialFacts, CategoryFact } from './financial-facts';

export type HsebliFactItem = {
  label: string;
  value: string;
  isHighlight?: boolean;
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
  suggestedQuestions?: string[];
};

/**
 * Extracts a numeric TND amount from queries like "can I spend 50 dt" or "najjem nosref 120 tnd".
 */
function extractRequestedAmount(query: string): number | null {
  const match = query.match(/(\d+(?:[.,]\d+)?)\s*(?:dt|tnd|dinar|dinars|millimes|k)?/i);
  if (match && match[1]) {
    const parsed = parseFloat(match[1].replace(',', '.'));
    return isNaN(parsed) ? null : parsed * 1000;
  }
  return null;
}

export function processHsebliQuery(query: string, facts: FinancialFacts): HsebliResponse {
  const q = query.toLowerCase().trim();
  const id = `ans_${Date.now()}`;

  // 1. Food & Dining query
  if (
    q.includes('food') ||
    q.includes('mekla') ||
    q.includes('makla') ||
    q.includes('nourriture') ||
    q.includes('resto') ||
    q.includes('ftour') ||
    q.includes('mlawi') ||
    q.includes('sandwich') ||
    q.includes('manger')
  ) {
    const foodCat = facts.sortedCategories.find((c) => c.category === 'food');
    const foodSpend = foodCat ? foodCat.amountMillimes : 0;
    const foodPct = foodCat ? foodCat.percentage : 0;

    if (foodSpend === 0) {
      return {
        id,
        title: 'Food & Dining Spending',
        body: 'You haven’t recorded any food or dining expenses this month yet.',
        suggestedQuestions: ['Where did my money go this month?', 'Can I spend 30 TND today?'],
      };
    }

    return {
      id,
      title: 'Food & Dining Spending',
      body: `You have spent ${formatMoney(foodSpend)} on food and dining this month (${foodPct}% of your total monthly expenses across ${foodCat?.count ?? 0} transactions).`,
      factsCard: {
        title: 'Food Analytics',
        items: [
          { label: 'Total Food Spend', value: formatMoney(foodSpend), isHighlight: true },
          { label: 'Percentage of Expenses', value: `${foodPct}%` },
          { label: 'Recorded Meals/Groceries', value: `${foodCat?.count ?? 0} transactions` },
        ],
      },
      suggestedQuestions: ['What is my biggest expense?', 'Can I spend 50 TND today?', 'Compare to last month'],
    };
  }

  // 2. Affordability Check ("Can I spend X TND?" / "Najjem nosref 50 DT?")
  if (
    q.includes('can i spend') ||
    q.includes('najjem nosref') ||
    q.includes('najem nosref') ||
    q.includes('puis-je depenser') ||
    q.includes('nosref') ||
    q.includes('spend') ||
    q.includes('afford')
  ) {
    const requestedAmountMillimes = extractRequestedAmount(q);
    const amountToCheck = requestedAmountMillimes ?? 50000; // default 50 TND if unspecified
    const remainingBalance = facts.totalBalanceMillimes - amountToCheck;
    const isAffordable = remainingBalance >= 0;
    const days = Math.max(1, facts.daysUntilPayday);
    const newDailyRate = Math.floor(Math.max(0, remainingBalance) / days);

    if (!isAffordable) {
      return {
        id,
        title: 'Spending Check',
        body: `Spending ${formatMoney(amountToCheck)} would exceed your total current balance of ${formatMoney(facts.totalBalanceMillimes)}.`,
        factsCard: {
          title: 'Cashflow Impact',
          items: [
            { label: 'Current Balance', value: formatMoney(facts.totalBalanceMillimes) },
            { label: 'Requested Spend', value: formatMoney(amountToCheck), isHighlight: true },
            { label: 'Shortfall', value: formatMoney(Math.abs(remainingBalance)) },
          ],
        },
        suggestedQuestions: ['Where did my money go this month?', 'What are my account balances?'],
      };
    }

    const advice =
      amountToCheck <= facts.safeDailySpendRateMillimes
        ? 'This fits comfortably within your daily safe-to-spend limit.'
        : `This is higher than your current safe daily rate (${formatMoney(facts.safeDailySpendRateMillimes)}/day). It will leave you with ${formatMoney(newDailyRate)}/day until next salary.`;

    return {
      id,
      title: 'Spending Check',
      body: `Yes, you can spend ${formatMoney(amountToCheck)}. ${advice}`,
      factsCard: {
        title: 'Cashflow Impact',
        items: [
          { label: 'Available Balance', value: formatMoney(facts.totalBalanceMillimes) },
          { label: 'Balance After Spend', value: formatMoney(remainingBalance) },
          { label: 'Remaining Daily Pace', value: `${formatMoney(newDailyRate)} / day`, isHighlight: true },
          { label: 'Days Until Salary', value: `${facts.daysUntilPayday} days` },
        ],
      },
      suggestedQuestions: ['What are my account balances?', 'What is my top spending category?'],
    };
  }

  // 3. Compare to Last Month
  if (
    q.includes('compare') ||
    q.includes('last month') ||
    q.includes('chhar elli fet') ||
    q.includes('mois dernier') ||
    q.includes('evolution') ||
    q.includes('difference')
  ) {
    const diff = facts.monthOverMonthExpenseDiffMillimes;
    const isHigher = diff > 0;
    const diffFormatted = formatMoney(Math.abs(diff));

    return {
      id,
      title: 'Month-over-Month Comparison',
      body:
        facts.lastMonthExpenseMillimes === 0
          ? `You have spent ${formatMoney(facts.thisMonthExpenseMillimes)} this month. No complete records found for last month.`
          : isHigher
          ? `You have spent ${diffFormatted} more than last month at this point (${formatMoney(facts.thisMonthExpenseMillimes)} vs ${formatMoney(facts.lastMonthExpenseMillimes)}).`
          : `Great job! You have spent ${diffFormatted} less than last month (${formatMoney(facts.thisMonthExpenseMillimes)} vs ${formatMoney(facts.lastMonthExpenseMillimes)}).`,
      factsCard: {
        title: 'Spending Comparison',
        items: [
          { label: 'This Month Expenses', value: formatMoney(facts.thisMonthExpenseMillimes), isHighlight: true },
          { label: 'Last Month Expenses', value: formatMoney(facts.lastMonthExpenseMillimes) },
          { label: 'Net Difference', value: `${isHigher ? '+' : '-'}${diffFormatted}` },
        ],
      },
      suggestedQuestions: ['Where did my money go this month?', 'What is my biggest expense?'],
    };
  }

  // 4. Accounts & Balances Breakdown
  if (
    q.includes('account') ||
    q.includes('balance') ||
    q.includes('solde') ||
    q.includes('compte') ||
    q.includes('flouci') ||
    q.includes('d17') ||
    q.includes('carte') ||
    q.includes('bank') ||
    q.includes('espece') ||
    q.includes('cash') ||
    q.includes('kadech andi')
  ) {
    return {
      id,
      title: 'Account Balances',
      body: `You have a total of ${formatMoney(facts.totalBalanceMillimes)} across ${facts.accountBreakdown.length} accounts.`,
      factsCard: {
        title: 'Account Breakdown',
        items: facts.accountBreakdown.map((a) => ({
          label: `${a.emoji} ${a.name}`,
          value: formatMoney(a.balanceMillimes),
        })),
      },
      suggestedQuestions: ['Can I spend 50 TND today?', 'Where did my money go this month?'],
    };
  }

  // 5. Largest / Top Expenses & Categories
  if (
    q.includes('biggest') ||
    q.includes('top') ||
    q.includes('largest') ||
    q.includes('akber') ||
    q.includes('plus grand') ||
    q.includes('where did my money go') ||
    q.includes('win yemchi') ||
    q.includes('win mche') ||
    q.includes('ou va mon argent') ||
    q.includes('sraft') ||
    q.includes('categories')
  ) {
    if (facts.thisMonthExpenseMillimes === 0) {
      return {
        id,
        title: 'Monthly Spending Breakdown',
        body: 'You have not recorded any expenses for this month yet.',
        suggestedQuestions: ['What are my account balances?', 'Can I spend 50 TND today?'],
      };
    }

    return {
      id,
      title: 'Monthly Spending Breakdown',
      body: `You spent ${formatMoney(facts.thisMonthExpenseMillimes)} this month across ${facts.sortedCategories.length} categories. Your #1 category is ${facts.topCategory?.label ?? 'General'} (${facts.topCategory?.percentage ?? 0}%).`,
      categories: facts.sortedCategories,
      factsCard: {
        title: 'Top Highlights',
        items: [
          { label: 'Total Monthly Spend', value: formatMoney(facts.thisMonthExpenseMillimes), isHighlight: true },
          { label: 'Top Category', value: `${facts.topCategory?.label ?? 'N/A'} (${formatMoney(facts.topCategory?.amountMillimes ?? 0)})` },
          ...(facts.largestExpense
            ? [{ label: 'Largest Single Expense', value: `${facts.largestExpense.title} (${formatMoney(facts.largestExpense.amountMillimes)})` }]
            : []),
        ],
      },
      suggestedQuestions: ['How much did I spend on food?', 'Can I spend 100 TND today?', 'Compare to last month'],
    };
  }

  // 6. Coffee / Daily Habit tracker
  if (q.includes('coffee') || q.includes('kahwa') || q.includes('cafe') || q.includes('9ahwa') || q.includes('snack')) {
    return {
      id,
      title: 'Café & Daily Snacks',
      body: `You recorded ${formatMoney(facts.cafeSnacksSpendMillimes)} on café visits and quick daily snacks this month.`,
      factsCard: {
        title: 'Daily Habits',
        items: [
          { label: 'Café & Snacks Total', value: formatMoney(facts.cafeSnacksSpendMillimes), isHighlight: true },
          { label: 'Micro Transactions (≤5 TND)', value: `${facts.microExpensesCount} recorded` },
        ],
      },
      suggestedQuestions: ['Where did my money go this month?', 'Can I spend 50 TND today?'],
    };
  }

  // Default fallback response with comprehensive snapshot
  return {
    id,
    title: 'Financial Health Snapshot',
    body: `Here is your current financial snapshot: Total balance is ${formatMoney(facts.totalBalanceMillimes)}, with ${formatMoney(facts.thisMonthExpenseMillimes)} spent and ${formatMoney(facts.thisMonthIncomeMillimes)} earned this month.`,
    factsCard: {
      title: 'Overview',
      items: [
        { label: 'Available Balance', value: formatMoney(facts.totalBalanceMillimes), isHighlight: true },
        { label: 'Safe Daily Pace', value: `${formatMoney(facts.safeDailySpendRateMillimes)} / day` },
        { label: 'Top Spending Category', value: facts.topCategory ? `${facts.topCategory.label} (${formatMoney(facts.topCategory.amountMillimes)})` : 'None yet' },
      ],
    },
    suggestedQuestions: [
      'Where did my money go this month?',
      'How much did I spend on food?',
      'Can I spend 50 TND today?',
      'What are my account balances?',
    ],
  };
}
