import { StyleSheet, View } from 'react-native';
import { categoryFor } from '@/constants/categories';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { Text } from '@/components/ui/Text';
import type { TransactionCategory } from '@/types/transaction';

type BudgetProgressBarProps = {
  category: TransactionCategory;
  spentMillimes: number;
  budgetMillimes: number;
};

export function BudgetProgressBar({ category, spentMillimes, budgetMillimes }: BudgetProgressBarProps) {
  const categoryInfo = categoryFor(category);
  const percentage = budgetMillimes > 0 ? Math.round((spentMillimes / budgetMillimes) * 100) : 0;
  const isOver = percentage > 100;
  const isWarning = percentage >= 80 && !isOver;

  const barColor = isOver ? colors.expense : isWarning ? colors.warning : colors.income;
  const progressWidth = Math.min(100, percentage);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{categoryInfo.label}</Text>
        </View>
        <View style={styles.amounts}>
          <Text style={styles.spentText}>{formatMoney(spentMillimes)}</Text>
          <Text style={styles.budgetText}> / {formatMoney(budgetMillimes)}</Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progressWidth}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" style={[styles.percentageText, { color: barColor }]}>
          {isOver ? `⚠️ Over budget by ${formatMoney(spentMillimes - budgetMillimes)} (${percentage}%)` : `${percentage}% used`}
        </Text>
        {!isOver && (
          <Text variant="caption" style={styles.remainingText}>
            {formatMoney(budgetMillimes - spentMillimes)} remaining
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  budgetText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
