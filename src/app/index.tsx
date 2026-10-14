import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, ArrowRight, BarChart3, Bot, CirclePlus, ReceiptText, SlidersHorizontal, WalletCards } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BalanceCard } from '@/components/finance/BalanceCard';
import { MonthSummaryCard } from '@/components/finance/MonthSummaryCard';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { AccountPill } from '@/components/finance/AccountPill';
import { AccountBalanceModal } from '@/components/finance/AccountBalanceModal';
import { QuickExpenseBar, type QuickFavorite } from '@/components/finance/QuickExpenseBar';
import { PaydayBanner } from '@/components/finance/PaydayBanner';
import { SafeToSpendCard } from '@/components/finance/SafeToSpendCard';
import { SpendingCategoryChart } from '@/components/finance/SpendingCategoryChart';
import { DailySpendingHistogram } from '@/components/finance/DailySpendingHistogram';
import { MonthHealthCard } from '@/components/finance/MonthHealthCard';
import { PeriodNavigator } from '@/components/finance/PeriodNavigator';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { endOfMonth, formatMonthKey, formatToday, getLocalMonthKey, shiftMonthKey } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import { useTransactions } from '@/features/transactions/transaction-store';
import { extractFinancialFacts } from '@/lib/financial-facts';
import { getEarliestMonthKey, transactionsInMonth } from '@/lib/period-analytics';
import { calculateSafeDailySpend, getDaysUntilPayday, isPaydayDueForConfirmation } from '@/lib/salary';

export default function HomeScreen() {
  const router = useRouter();
  const {
        balanceMillimes,
    transactions,
    accounts,
    accountBalances,
    salaryRule,
    categoryBudgets,
    customCategories,
    confirmSalaryPayment,
    updateAccountOpeningBalance,
    isLoading,
  } = useTransactions();

  const [isPaydayDismissed, setIsPaydayDismissed] = useState(false);
  const [isConfirmingSalary, setIsConfirmingSalary] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const now = new Date();
  const currentMonthKey = getLocalMonthKey(now);
  // The month whose stats are shown. Users can browse back to any month that has data.
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const isCurrentMonth = selectedMonthKey === currentMonthKey;
  const earliestMonthKey = useMemo(() => getEarliestMonthKey(transactions), [transactions]);
  const selectedMonthLabel = formatMonthKey(selectedMonthKey);
  const selectedMonthTransactions = useMemo(
    () => transactionsInMonth(transactions, selectedMonthKey),
    [selectedMonthKey, transactions],
  );

  const daysUntilPayday = salaryRule ? getDaysUntilPayday(salaryRule.dayOfMonth, now) : 0;
  const isPaydayDue = isPaydayDueForConfirmation(salaryRule, transactions, now);
  const safeSpendMetrics = salaryRule ? calculateSafeDailySpend(balanceMillimes, daysUntilPayday) : undefined;

  // Extracted comprehensive financial facts for charts
  const facts = extractFinancialFacts(
    transactions,
    accounts,
    accountBalances,
    salaryRule,
    categoryBudgets,
    customCategories,
    now,
    selectedMonthKey,
  );
  const topCategory = facts.topCategory;

  const handleSelectFavorite = useCallback((favorite: QuickFavorite) => {
    router.navigate({
      pathname: '/add-transaction',
      params: {
        type: 'expense',
        amount: String(favorite.amountMillimes / 1000),
        category: favorite.category,
        note: favorite.label,
      },
    });
  }, [router]);

  const handleConfirmSalary = useCallback(async () => {
    if (!salaryRule) return;
    setIsConfirmingSalary(true);
    try {
      await confirmSalaryPayment(salaryRule);
      Alert.alert(
        'Salary Confirmed! 🎉',
        `${formatMoney(salaryRule.amountMillimes)} has been added to your balance.`,
      );
    } catch (error) {
      Alert.alert('Confirmation failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsConfirmingSalary(false);
    }
  }, [confirmSalaryPayment, salaryRule]);

  const handleSaveStartingBalances = useCallback(async (balances: Record<string, number>) => {
    for (const [accId, millimes] of Object.entries(balances)) {
      await updateAccountOpeningBalance(accId, millimes);
    }
    Alert.alert('Balances Updated', 'Your starting account balances have been saved.');
  }, [updateAccountOpeningBalance]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="caption">{formatToday(now)}</Text>
          <Text variant="title">Dinary</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>D</Text>
        </View>
      </View>

      <View style={styles.intro}>
        <Text variant="subtitle">Win yemchi dinarek?</Text>
        <Text variant="caption">Your {selectedMonthLabel} money overview</Text>
      </View>

      {/* Month Navigator: browse the stats of past months */}
      <PeriodNavigator
        label={selectedMonthLabel}
        unit="month"
        canGoBack={selectedMonthKey > earliestMonthKey}
        canGoForward={!isCurrentMonth}
        onBack={() => setSelectedMonthKey((key) => shiftMonthKey(key, -1))}
        onForward={() => setSelectedMonthKey((key) => shiftMonthKey(key, 1))}
        resetLabel={isCurrentMonth ? undefined : 'Back to this month'}
        onReset={() => setSelectedMonthKey(currentMonthKey)}
      />

      {/* Payday 1-Tap Confirmation Banner */}
      {isPaydayDue && !isPaydayDismissed && salaryRule && (
        <PaydayBanner
          salaryRule={salaryRule}
          isConfirming={isConfirmingSalary}
          onConfirm={() => void handleConfirmSalary()}
          onDismiss={() => setIsPaydayDismissed(true)}
        />
      )}

      {/* Balance Card */}
      <BalanceCard
        balanceMillimes={balanceMillimes}
        incomeMillimes={facts.thisMonthIncomeMillimes}
        expenseMillimes={facts.thisMonthExpenseMillimes}
        periodLabel={isCurrentMonth ? undefined : selectedMonthLabel}
      />

      {/* Safe to Spend Velocity Card (only meaningful for the running month) */}
      {isCurrentMonth && (
        <SafeToSpendCard
          metrics={safeSpendMetrics}
          hasSalaryConfigured={Boolean(salaryRule)}
          onPressConfigure={() => router.navigate('/salary')}
        />
      )}

      {/* Accounts Breakdown with Starting Balance Adjuster */}
      <View style={styles.accountsSection}>
        <View style={styles.accountsHeader}>
          <Text variant="label">YOUR ACCOUNTS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adjust starting account balances"
            onPress={() => setIsBalanceModalOpen(true)}
            style={styles.adjustBtn}
          >
            <SlidersHorizontal size={13} color={colors.primaryDark} />
            <Text style={styles.adjustBtnText}>Starting balances</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
          {accounts.map((acc) => (
            <AccountPill
              key={acc.id}
              name={acc.name}
              emoji={acc.emoji}
              balanceMillimes={accountBalances[acc.id] ?? 0}
            />
          ))}
        </ScrollView>
      </View>

      {/* Account Starting Balance Modal */}
      {isBalanceModalOpen && (
        <AccountBalanceModal
          visible={isBalanceModalOpen}
          accounts={accounts}
          onClose={() => setIsBalanceModalOpen(false)}
          onSave={handleSaveStartingBalances}
        />
      )}

      {/* Quick Actions */}
      <View style={styles.actions}>
        <QuickAction label="Expense" Icon={CirclePlus} onPress={() => router.navigate({ pathname: '/add-transaction', params: { type: 'expense' } })} />
        <QuickAction label="Income" Icon={WalletCards} onPress={() => router.navigate({ pathname: '/add-transaction', params: { type: 'income' } })} />
        <QuickAction label="Transfer" Icon={ArrowLeftRight} onPress={() => router.navigate({ pathname: '/add-transaction', params: { type: 'transfer' } })} />
        <QuickAction label="Hsebli" Icon={Bot} onPress={() => router.navigate('/assistant')} />
      </View>

      {/* 1-Tap Daily Expense Shortcuts */}
      <QuickExpenseBar onSelectFavorite={handleSelectFavorite} />

      {/* Visual Spending Analytics Section */}
      <View style={styles.sectionHeader}>
        <Text variant="subtitle">Spending Analytics</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open the ${selectedMonthKey.slice(0, 4)} yearly report`}
          onPress={() => router.navigate({ pathname: '/reports', params: { year: selectedMonthKey.slice(0, 4) } })}
          style={({ pressed }) => [styles.yearBtn, pressed && styles.pressed]}
        >
          <BarChart3 size={14} color={colors.primaryDark} />
          <Text style={styles.adjustBtnText}>Year view</Text>
        </Pressable>
      </View>

      {/* Monthly Cashflow & Savings Health Card */}
      <MonthHealthCard facts={facts} />

      {/* Category Proportional Distribution Chart */}
      <SpendingCategoryChart
        categories={facts.sortedCategories}
        totalExpenseMillimes={facts.thisMonthExpenseMillimes}
      />

      {/* Daily Spending Rhythm Histogram */}
      <DailySpendingHistogram
        transactions={selectedMonthTransactions}
        safeDailyRateMillimes={isCurrentMonth ? facts.safeDailySpendRateMillimes : 0}
        referenceDate={isCurrentMonth ? now : endOfMonth(selectedMonthKey)}
        showToday={isCurrentMonth}
      />

      {/* Month Analytics Carousel */}
      <View style={styles.sectionHeader}>
        <Text variant="subtitle">{isCurrentMonth ? 'This month' : selectedMonthLabel}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
        <MonthSummaryCard
          eyebrow="TOP CATEGORY"
          title={topCategory ? `${topCategory.emoji} ${topCategory.label}` : 'No expenses yet'}
          detail={topCategory ? `${formatMoney(topCategory.amountMillimes)} spent (${topCategory.percentage}%)` : isCurrentMonth ? 'Add an expense to see your spending.' : 'No expenses recorded in this month.'}
        />
        {facts.largestExpense && (
          <MonthSummaryCard
            eyebrow="LARGEST EXPENSE"
            title={formatMoney(facts.largestExpense.amountMillimes)}
            detail={facts.largestExpense.note ? `${facts.largestExpense.title} · ${facts.largestExpense.note}` : facts.largestExpense.title}
          />
        )}
        {isCurrentMonth && <Pressable onPress={() => router.navigate('/salary')}>
          <MonthSummaryCard
            eyebrow="EXPECTED SALARY"
            title={salaryRule ? formatMoney(salaryRule.amountMillimes) : 'Not configured'}
            detail={
              salaryRule
                ? daysUntilPayday === 0
                  ? 'Payday is today 🎉'
                  : `In ${daysUntilPayday} ${daysUntilPayday === 1 ? 'day' : 'days'}`
                : 'Set up an expected salary rule.'
            }
          />
        </Pressable>}
      </ScrollView>

      {/* Recent Activity */}
      <View style={styles.sectionHeader}>
        <Text variant="subtitle">{isCurrentMonth ? 'Recent activity' : `${selectedMonthLabel} activity`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all transactions of ${selectedMonthLabel}`}
          onPress={() => router.navigate({ pathname: '/transactions', params: { month: selectedMonthKey } })}
          style={styles.viewAll}
        >
          <Text style={styles.viewAllText}>See all</Text>
          <ArrowRight size={16} color={colors.primary} />
        </Pressable>
      </View>

      {isLoading ? (
        <Text variant="caption">Loading your local data…</Text>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Add your first expense or income to start tracking your TND."
          action={
            <Pressable onPress={() => router.navigate('/add-transaction')}>
              <Text style={styles.viewAllText}>Add transaction</Text>
            </Pressable>
          }
        />
      ) : selectedMonthTransactions.length === 0 ? (
        <EmptyState
          title={`Nothing recorded in ${selectedMonthLabel}`}
          description="Use the arrows above to look at another month."
        />
      ) : (
        <Card variant="default" style={styles.transactions}>
          {selectedMonthTransactions.slice(0, 4).map((transaction, index) => (
            <View key={transaction.id}>
              {index > 0 && <View style={styles.line} />}
              <TransactionItem transaction={transaction} />
            </View>
          ))}
        </Card>
      )}

      {/* Insight Card */}
      <Card variant="muted" style={styles.insight}>
        <ReceiptText size={22} color={colors.accent} />
        <View style={styles.insightText}>
          <Text style={styles.insightTitle}>A small insight</Text>
          <Text variant="caption">
            {topCategory
              ? `${topCategory.label} is your largest expense category ${isCurrentMonth ? 'this month' : `in ${selectedMonthLabel}`} (${topCategory.percentage}% of spending).`
              : 'Insights will appear after you add transactions.'}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function QuickAction({ label, Icon, onPress }: { label: string; Icon: typeof CirclePlus; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label}`} onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
      <Icon size={20} color={colors.primary} />
      <Text variant="caption" style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  avatarText: { color: colors.primary, fontWeight: '800' },
  intro: { gap: 2 },
  accountsSection: { gap: 8 },
  accountsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  adjustBtnText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  yearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 32, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  accountsScroll: { gap: 10, paddingRight: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  quick: { flex: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quickLabel: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { color: colors.primary, fontWeight: '700' },
  summaryScroll: { gap: 12, paddingRight: 20 },
  transactions: { paddingVertical: 3 },
  line: { height: 1, backgroundColor: colors.border, marginLeft: 54 },
  insight: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  insightText: { flex: 1, gap: 3 },
  insightTitle: { fontWeight: '800' },
});


