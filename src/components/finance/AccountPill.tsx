import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';

type AccountPillProps = {
  name: string;
  emoji: string;
  balanceMillimes: number;
  selected?: boolean;
  onPress?: () => void;
};

export function AccountPill({ name, emoji, balanceMillimes, selected, onPress }: AccountPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${formatMoney(balanceMillimes)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.selectedPill,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text variant="caption" style={[styles.name, selected && styles.selectedText]}>
          {name}
        </Text>
      </View>
      <Text style={[styles.amount, selected && styles.selectedAmount]}>
        {formatMoney(balanceMillimes)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 120,
    gap: 3,
  },
  selectedPill: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 14,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.primaryDark,
  },
  amount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  selectedAmount: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.75,
  },
});
