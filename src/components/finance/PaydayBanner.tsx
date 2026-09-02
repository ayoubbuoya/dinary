import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Sparkles, X } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { accountConfigFor } from '@/constants/accounts';
import type { RecurringRule } from '@/types/recurring';

type PaydayBannerProps = {
  salaryRule: RecurringRule;
  isConfirming?: boolean;
  onConfirm: () => void;
  onDismiss?: () => void;
};

export function PaydayBanner({ salaryRule, isConfirming, onConfirm, onDismiss }: PaydayBannerProps) {
  const accountConfig = accountConfigFor(salaryRule.accountId);

  return (
    <Card variant="default" style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Sparkles size={14} color={colors.primaryDark} />
          <Text style={styles.badgeText}>PAYDAY ARRIVAL</Text>
        </View>
        {onDismiss && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss payday banner"
            onPress={onDismiss}
            style={styles.dismissButton}
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Did your salary arrive?</Text>
        <Text variant="caption" style={styles.description}>
          Record <Text style={styles.amountHighlight}>{formatMoney(salaryRule.amountMillimes)}</Text> expected in{' '}
          <Text style={styles.accountHighlight}>
            {accountConfig.emoji} {accountConfig.name}
          </Text>{' '}
          for this month with 1 tap.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm salary received"
          disabled={isConfirming}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.pressed,
            isConfirming && styles.disabled,
          ]}
        >
          <Check size={16} color={colors.white} />
          <Text style={styles.confirmText}>
            {isConfirming ? 'Recording…' : 'Confirm received (1-Tap)'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
    gap: 10,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  dismissButton: {
    padding: 4,
  },
  body: {
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532D',
  },
  description: {
    color: '#166534',
    lineHeight: 18,
  },
  amountHighlight: {
    fontWeight: '800',
    color: '#15803D',
  },
  accountHighlight: {
    fontWeight: '700',
    color: '#14532D',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 2,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  confirmText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
