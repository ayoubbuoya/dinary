import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, Gauge, ShieldCheck, Zap } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import type { SafeSpendMetrics } from '@/lib/salary';

type SafeToSpendCardProps = {
  metrics?: SafeSpendMetrics;
  hasSalaryConfigured: boolean;
  onPressConfigure?: () => void;
};

export function SafeToSpendCard({
  metrics,
  hasSalaryConfigured,
  onPressConfigure,
}: SafeToSpendCardProps) {
  if (!hasSalaryConfigured || !metrics) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Configure salary for safe-to-spend pacing"
        onPress={onPressConfigure}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card variant="muted" style={styles.unconfiguredCard}>
          <View style={styles.iconContainer}>
            <Gauge size={22} color={colors.accent} />
          </View>
          <View style={styles.unconfiguredContent}>
            <Text style={styles.unconfiguredTitle}>Safe-to-Spend Pacing</Text>
            <Text variant="caption">
              Configure your expected salary date to see your daily safe spending rate.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSoft} />
        </Card>
      </Pressable>
    );
  }

  const isCritical = metrics.status === 'critical';
  const isTight = metrics.status === 'tight';
  const isModerate = metrics.status === 'moderate';

  const badgeStyle = isCritical
    ? styles.criticalBadge
    : isTight
    ? styles.tightBadge
    : isModerate
    ? styles.moderateBadge
    : styles.healthyBadge;

  const badgeTextStyle = isCritical
    ? styles.criticalBadgeText
    : isTight
    ? styles.tightBadgeText
    : isModerate
    ? styles.moderateBadgeText
    : styles.healthyBadgeText;

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Zap size={16} color={colors.accent} />
          <Text variant="label">SAFE DAILY VELOCITY</Text>
        </View>
        <View style={[styles.statusBadge, badgeStyle]}>
          <Text style={[styles.statusText, badgeTextStyle]}>{metrics.statusLabel}</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <Text style={styles.dailyAmount}>{formatMoney(metrics.dailyRateMillimes)}</Text>
        <Text style={styles.dailySuffix}>/ day</Text>
      </View>

      <View style={styles.footerRow}>
        <ShieldCheck size={14} color={colors.primary} />
        <Text variant="caption" style={styles.footerText}>
          Paced across <Text style={styles.bold}>{metrics.daysRemaining} {metrics.daysRemaining === 1 ? 'day' : 'days'}</Text> until next salary
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  unconfiguredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unconfiguredContent: {
    flex: 1,
    gap: 2,
  },
  unconfiguredTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  healthyBadge: {
    backgroundColor: colors.primarySoft,
  },
  healthyBadgeText: {
    color: colors.primaryDark,
  },
  moderateBadge: {
    backgroundColor: colors.accentSoft,
  },
  moderateBadgeText: {
    color: colors.accent,
  },
  tightBadge: {
    backgroundColor: '#FEE2E2',
  },
  tightBadgeText: {
    color: colors.expense,
  },
  criticalBadge: {
    backgroundColor: '#FEE2E2',
  },
  criticalBadgeText: {
    color: colors.expense,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  dailyAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  dailySuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    color: colors.textMuted,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.75,
  },
});
