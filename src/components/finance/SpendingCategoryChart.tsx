import { StyleSheet, View } from 'react-native';
import { PieChart } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import type { CategoryFact } from '@/lib/financial-facts';

const categoryColorPalette: Record<string, string> = {
  food: '#10B981', // Emerald
  groceries: '#06B6D4', // Cyan
  transport: '#3B82F6', // Blue
  coffee: '#8B5CF6', // Purple
  bills: '#F59E0B', // Amber
  family: '#F97316', // Orange
  shopping: '#EC4899', // Pink
  health: '#EF4444', // Red
  other: '#6B7280', // Slate
};

type SpendingCategoryChartProps = {
  categories: CategoryFact[];
  totalExpenseMillimes: number;
};

export function SpendingCategoryChart({
  categories,
  totalExpenseMillimes,
}: SpendingCategoryChartProps) {
  if (categories.length === 0 || totalExpenseMillimes === 0) {
    return (
      <Card variant="default" style={styles.emptyCard}>
        <View style={styles.header}>
          <PieChart size={16} color={colors.primary} />
          <Text variant="label">CATEGORY SPENDING DISTRIBUTION</Text>
        </View>
        <Text variant="caption">Record expenses to see your visual category distribution.</Text>
      </Card>
    );
  }

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <PieChart size={16} color={colors.primary} />
          <Text variant="label">CATEGORY DISTRIBUTION</Text>
        </View>
        <Text style={styles.totalText}>{formatMoney(totalExpenseMillimes)}</Text>
      </View>

      {/* Segmented Progress Bar */}
      <View style={styles.segmentedBar}>
        {categories.map((cat) => {
          const color = categoryColorPalette[cat.category] ?? '#6B7280';
          const flex = Math.max(0.5, cat.percentage);
          return (
            <View
              key={cat.category}
              style={[
                styles.segment,
                {
                  flex,
                  backgroundColor: color,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Category Legend & Breakdown List */}
      <View style={styles.legendGrid}>
        {categories.map((cat) => {
          const color = categoryColorPalette[cat.category] ?? '#6B7280';
          return (
            <View key={cat.category} style={styles.legendItem}>
              <View style={styles.legendLeft}>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <View>
                  <Text style={styles.legendCategoryName}>{cat.label}</Text>
                  <Text variant="caption">{cat.percentage}% · {cat.count} txns</Text>
                </View>
              </View>
              <Text style={styles.legendAmount}>{formatMoney(cat.amountMillimes)}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  emptyCard: {
    gap: 8,
    padding: 14,
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
  totalText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  segmentedBar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  segment: {
    height: '100%',
    borderRadius: 2,
  },
  legendGrid: {
    gap: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  legendCategoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
});
