import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatShortMonth } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import type { MonthPoint } from '@/lib/period-analytics';

type MonthlyBarsChartProps = {
  months: MonthPoint[];
  /** Month keys after this one are drawn faded because they have not happened yet. */
  currentMonthKey?: string;
  onPressMonth?: (monthKey: string) => void;
};

const CHART_HEIGHT = 110;

/** Income (green) and expense (red) bars for each month of a period. */
export function MonthlyBarsChart({ months, currentMonthKey, onPressMonth }: MonthlyBarsChartProps) {
  const maxValue = Math.max(10000, ...months.map((month) => Math.max(month.incomeMillimes, month.expenseMillimes)));
  const heightFor = (value: number) => (value > 0 ? Math.max(4, Math.round((value / maxValue) * CHART_HEIGHT)) : 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bars}>
        {months.map((month) => {
          const isFuture = currentMonthKey ? month.monthKey > currentMonthKey : false;
          return (
            <Pressable
              key={month.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`${formatShortMonth(month.monthKey)}: income ${formatMoney(month.incomeMillimes)}, expenses ${formatMoney(month.expenseMillimes)}`}
              disabled={!onPressMonth || isFuture}
              onPress={() => onPressMonth?.(month.monthKey)}
              style={({ pressed }) => [styles.column, isFuture && styles.future, pressed && styles.pressed]}
            >
              <View style={[styles.barArea, { height: CHART_HEIGHT }]}>
                <View style={[styles.bar, styles.income, { height: heightFor(month.incomeMillimes) }]} />
                <View style={[styles.bar, styles.expense, { height: heightFor(month.expenseMillimes) }]} />
              </View>
              <Text style={[styles.label, month.monthKey === currentMonthKey && styles.currentLabel]}>
                {formatShortMonth(month.monthKey).slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, styles.income]} /><Text variant="caption">Income (+)</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.expense]} /><Text variant="caption">Expenses (−)</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', gap: 4, minHeight: 44 },
  future: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  barArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 6, borderRadius: radius.pill },
  income: { backgroundColor: colors.income },
  expense: { backgroundColor: colors.expense },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  currentLabel: { color: colors.primary, fontWeight: '900' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
