import { StyleSheet, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import type { FinancialFacts } from '@/lib/financial-facts';

type MonthHealthCardProps = {
  facts: FinancialFacts;
};

export function MonthHealthCard({ facts }: MonthHealthCardProps) {
  const isPositiveSavings = facts.thisMonthNetSavingsMillimes >= 0;
  const savingsRate =
    facts.thisMonthIncomeMillimes > 0
      ? Math.round((facts.thisMonthNetSavingsMillimes / facts.thisMonthIncomeMillimes) * 100)
      : 0;

  const diff = facts.monthOverMonthExpenseDiffMillimes;
  const isHigherExpense = diff > 0;

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TrendingUp size={16} color={colors.primary} />
          <Text variant="label">MONTHLY CASHFLOW & SAVINGS</Text>
        </View>
        <View style={[styles.badge, isPositiveSavings ? styles.positiveBadge : styles.negativeBadge]}>
          <Text style={[styles.badgeText, isPositiveSavings ? styles.positiveBadgeText : styles.negativeBadgeText]}>
            {isPositiveSavings ? `${savingsRate}% SAVINGS RATE` : 'NET DEFICIT'}
          </Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCol}>
          <Text variant="caption">INCOME</Text>
          <Text style={styles.incomeAmount}>+{formatMoney(facts.thisMonthIncomeMillimes)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricCol}>
          <Text variant="caption">EXPENSES</Text>
          <Text style={styles.expenseAmount}>-{formatMoney(facts.thisMonthExpenseMillimes)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricCol}>
          <Text variant="caption">NET SAVINGS</Text>
          <Text style={[styles.savingsAmount, isPositiveSavings ? styles.positiveText : styles.negativeText]}>
            {isPositiveSavings ? '+' : ''}{formatMoney(facts.thisMonthNetSavingsMillimes)}
          </Text>
        </View>
      </View>

      {/* Month over month comparison banner */}
      {facts.lastMonthExpenseMillimes > 0 && (
        <View style={styles.comparisonBanner}>
          {isHigherExpense ? (
            <ArrowUpRight size={14} color={colors.expense} />
          ) : (
            <ArrowDownRight size={14} color={colors.income} />
          )}
          <Text variant="caption" style={styles.comparisonText}>
            {isHigherExpense
              ? `${formatMoney(Math.abs(diff))} more spent than last month`
              : `${formatMoney(Math.abs(diff))} saved compared to last month`}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  positiveBadge: {
    backgroundColor: colors.primarySoft,
  },
  positiveBadgeText: {
    color: colors.primaryDark,
  },
  negativeBadge: {
    backgroundColor: '#FEE2E2',
  },
  negativeBadgeText: {
    color: colors.expense,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    borderRadius: radius.md,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  incomeAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.income,
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.expense,
  },
  savingsAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  positiveText: {
    color: colors.primaryDark,
  },
  negativeText: {
    color: colors.expense,
  },
  comparisonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  comparisonText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
