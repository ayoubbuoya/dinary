import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CalendarRange, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { MonthlyBarsChart } from '@/components/finance/MonthlyBarsChart';
import { PeriodNavigator } from '@/components/finance/PeriodNavigator';
import { SpendingCategoryChart } from '@/components/finance/SpendingCategoryChart';
import { colors, radius } from '@/constants/colors';
import { formatMonthKey, formatShortMonth, getLocalMonthKey } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import { getAvailableYears, summarizeYear } from '@/lib/period-analytics';
import { useTransactions } from '@/features/transactions/transaction-store';

/** Yearly money report: totals, month-by-month chart, categories and highlights. */
export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();
  const { transactions, customCategories, isLoading } = useTransactions();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = getLocalMonthKey(now);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Follow the ?year= param when it changes (state is adjusted during render, as React recommends).
  const [appliedYearParam, setAppliedYearParam] = useState<string | undefined>(undefined);
  if (params.year !== appliedYearParam) {
    setAppliedYearParam(params.year);
    if (params.year && /^\d{4}$/.test(params.year)) setSelectedYear(Number(params.year));
  }

  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const oldestYear = availableYears[availableYears.length - 1] ?? currentYear;
  const summary = useMemo(() => summarizeYear(transactions, selectedYear, customCategories), [customCategories, selectedYear, transactions]);
  const previous = useMemo(() => summarizeYear(transactions, selectedYear - 1, customCategories), [customCategories, selectedYear, transactions]);

  const isPositive = summary.netMillimes >= 0;
  const hasData = summary.incomeCount + summary.expenseCount > 0;
  const expenseChange = previous.expenseMillimes > 0
    ? Math.round(((summary.expenseMillimes - previous.expenseMillimes) / previous.expenseMillimes) * 100)
    : null;

  const openMonth = (monthKey: string) => router.navigate({ pathname: '/transactions', params: { month: monthKey } });

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <CalendarRange size={22} color={colors.primary} />
          <Text variant="title">Yearly report</Text>
        </View>
        <Text variant="caption">See how your money moved over a full year.</Text>
      </View>

      <PeriodNavigator
        label={String(selectedYear)}
        unit="year"
        canGoBack={selectedYear > oldestYear}
        canGoForward={selectedYear < currentYear}
        onBack={() => setSelectedYear((year) => year - 1)}
        onForward={() => setSelectedYear((year) => year + 1)}
        resetLabel={selectedYear === currentYear ? undefined : 'Back to this year'}
        onReset={() => setSelectedYear(currentYear)}
      />

      {isLoading ? (
        <Text variant="caption">Loading your local data…</Text>
      ) : !hasData ? (
        <EmptyState title={`Nothing recorded in ${selectedYear}`} description="Add transactions or use the arrows to look at another year." />
      ) : (
        <>
          {/* Year totals */}
          <Card variant="elevated" style={styles.totals}>
            <View style={styles.totalsHeader}>
              <Text variant="label" style={styles.primaryLabel}>{selectedYear} TOTALS</Text>
              <View style={[styles.badge, isPositive ? styles.positiveBadge : styles.negativeBadge]}>
                <Text style={[styles.badgeText, { color: isPositive ? colors.primaryDark : colors.expense }]}>
                  {summary.savingsRatePercent === null ? 'NO INCOME' : isPositive ? `${summary.savingsRatePercent}% SAVED` : 'NET DEFICIT'}
                </Text>
              </View>
            </View>
            <View style={styles.metrics}>
              <Metric label="Income" value={`+${formatMoney(summary.incomeMillimes)}`} color={colors.income} />
              <Metric label="Expenses" value={`-${formatMoney(summary.expenseMillimes)}`} color={colors.expense} />
              <Metric label="Net" value={formatMoney(summary.netMillimes, { sign: true })} color={isPositive ? colors.primaryDark : colors.expense} />
            </View>
            {expenseChange !== null && (
              <View style={styles.compareRow}>
                {expenseChange > 0 ? <TrendingUp size={14} color={colors.expense} /> : <TrendingDown size={14} color={colors.income} />}
                <Text variant="caption">
                  {expenseChange === 0
                    ? `Same spending as ${selectedYear - 1}.`
                    : `${Math.abs(expenseChange)}% ${expenseChange > 0 ? 'more' : 'less'} spending than ${selectedYear - 1} (${formatMoney(previous.expenseMillimes)}).`}
                </Text>
              </View>
            )}
          </Card>

          {/* Month by month chart */}
          <Card style={styles.card}>
            <Text variant="label">MONTH BY MONTH</Text>
            <MonthlyBarsChart
              months={summary.months}
              currentMonthKey={selectedYear === currentYear ? currentMonthKey : undefined}
              onPressMonth={openMonth}
            />
            <Text variant="caption" style={styles.hint}>Tap a month to see its transactions.</Text>
          </Card>

          {/* Highlights */}
          <Card variant="muted" style={styles.card}>
            <Text variant="label">HIGHLIGHTS</Text>
            <Highlight label="Average spending per active month" value={formatMoney(summary.averageMonthlyExpenseMillimes)} />
            <Highlight label="Average income per active month" value={formatMoney(summary.averageMonthlyIncomeMillimes)} />
            {summary.highestExpenseMonth && (
              <Highlight label="Highest spending month" value={`${formatMonthKey(summary.highestExpenseMonth.monthKey)} · ${formatMoney(summary.highestExpenseMonth.expenseMillimes)}`} />
            )}
            {summary.lowestExpenseMonth && summary.lowestExpenseMonth.monthKey !== summary.highestExpenseMonth?.monthKey && (
              <Highlight label="Lowest spending month" value={`${formatMonthKey(summary.lowestExpenseMonth.monthKey)} · ${formatMoney(summary.lowestExpenseMonth.expenseMillimes)}`} />
            )}
            {summary.largestExpense && (
              <Highlight label="Largest single expense" value={`${summary.largestExpense.title} · ${formatMoney(summary.largestExpense.amountMillimes)}`} />
            )}
            <Highlight label="Recorded transactions" value={`${summary.incomeCount + summary.expenseCount} (${summary.activeMonthCount} active months)`} />
          </Card>

          {/* Category distribution for the year */}
          <SpendingCategoryChart categories={summary.categories} totalExpenseMillimes={summary.expenseMillimes} />

          {/* Month table */}
          <Card style={styles.card}>
            <Text variant="label">MONTHLY DETAILS</Text>
            {summary.months
              .filter((month) => month.transactionCount > 0)
              .map((month) => (
                <Pressable
                  key={month.monthKey}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${formatMonthKey(month.monthKey)} transactions`}
                  onPress={() => openMonth(month.monthKey)}
                  style={({ pressed }) => [styles.monthRow, pressed && styles.pressed]}
                >
                  <Text style={styles.monthName}>{formatShortMonth(month.monthKey)}</Text>
                  <View style={styles.monthAmounts}>
                    <Text style={styles.incomeText}>+{formatMoney(month.incomeMillimes)}</Text>
                    <Text style={styles.expenseText}>-{formatMoney(month.expenseMillimes)}</Text>
                  </View>
                  <Text style={[styles.netText, { color: month.netMillimes >= 0 ? colors.primaryDark : colors.expense }]}>
                    {formatMoney(month.netMillimes, { sign: true })}
                  </Text>
                  <ArrowRight size={14} color={colors.textSoft} />
                </Pressable>
              ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="caption">{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.highlight}>
      <Text variant="caption" style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totals: { gap: 12 },
  totalsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryLabel: { color: colors.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  positiveBadge: { backgroundColor: colors.primarySoft },
  negativeBadge: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  metrics: { gap: 8 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800' },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { gap: 12 },
  hint: { textAlign: 'center' },
  highlight: { gap: 1 },
  highlightLabel: { fontSize: 12 },
  highlightValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  monthName: { width: 40, fontWeight: '800', color: colors.text },
  monthAmounts: { flex: 1, gap: 1 },
  incomeText: { fontSize: 11, fontWeight: '700', color: colors.income },
  expenseText: { fontSize: 11, fontWeight: '700', color: colors.expense },
  netText: { fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.65 },
});
