import { StyleSheet, View, ScrollView } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { getDaysInMonth } from '@/lib/salary';
import type { Transaction } from '@/types/transaction';

type DailySpendingHistogramProps = {
  transactions: Transaction[];
  safeDailyRateMillimes: number;
  referenceDate?: Date;
};

export function DailySpendingHistogram({
  transactions,
  safeDailyRateMillimes,
  referenceDate = new Date(),
}: DailySpendingHistogramProps) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();
  const totalDaysInMonth = getDaysInMonth(year, month);

  // Group current month expenses by day of month (1 to totalDaysInMonth)
  const dailyExpenses = new Array<number>(totalDaysInMonth + 1).fill(0);

  for (const t of transactions) {
    if (t.type === 'expense') {
      const d = new Date(t.occurredAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        dailyExpenses[day] = (dailyExpenses[day] ?? 0) + t.amountMillimes;
      }
    }
  }

  // Find max daily spend to scale bar heights
  const maxDaySpend = Math.max(...dailyExpenses, safeDailyRateMillimes, 10000);
  const chartHeight = 90;

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <BarChart3 size={16} color={colors.primary} />
          <Text variant="label">DAILY SPENDING RHYTHM</Text>
        </View>
        {safeDailyRateMillimes > 0 && (
          <View style={styles.safePaceBadge}>
            <Text style={styles.safePaceText}>
              Safe limit: {formatMoney(safeDailyRateMillimes)}/d
            </Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsContainer}>
        {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map((day) => {
          const spend = dailyExpenses[day] ?? 0;
          const isToday = day === currentDay;
          const isFuture = day > currentDay;
          const isExceeded = safeDailyRateMillimes > 0 && spend > safeDailyRateMillimes;
          const barHeight = spend > 0 ? Math.max(6, Math.round((spend / maxDaySpend) * chartHeight)) : 2;

          const barColor = isExceeded
            ? colors.expense
            : spend > 0
            ? colors.primary
            : colors.border;

          return (
            <View key={day} style={styles.dayColumn}>
              <View style={[styles.barWrapper, { height: chartHeight }]}>
                {spend > 0 && (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                )}
                {spend === 0 && (
                  <View
                    style={[
                      styles.emptyDot,
                      isFuture && styles.futureDot,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  isToday && styles.todayLabel,
                  isFuture && styles.futureLabel,
                ]}
              >
                {day}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text variant="caption">Normal spend</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.expense }]} />
          <Text variant="caption">Over safe pace</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.primaryDark }]} />
          <Text variant="caption">Today</Text>
        </View>
      </View>
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
  safePaceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  safePaceText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 16,
  },
  dayColumn: {
    alignItems: 'center',
    width: 18,
    gap: 4,
  },
  barWrapper: {
    width: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 10,
    borderRadius: radius.pill,
  },
  emptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  futureDot: {
    opacity: 0.3,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  todayLabel: {
    color: colors.primary,
    fontWeight: '900',
  },
  futureLabel: {
    opacity: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
