import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import type { TransactionCategory } from '@/types/transaction';

export type QuickFavorite = {
  id: string;
  label: string;
  emoji: string;
  amountMillimes: number;
  category: TransactionCategory;
};

export const defaultFavorites: QuickFavorite[] = [
  { id: 'coffee', label: 'Kahwa', emoji: '☕', amountMillimes: 2500, category: 'coffee' },
  { id: 'lunch', label: 'Mlawi / Lunch', emoji: '🌯', amountMillimes: 6000, category: 'food' },
  { id: 'taxi', label: 'Taxi / Metro', emoji: '🚕', amountMillimes: 3500, category: 'transport' },
  { id: 'bread', label: 'Groceries', emoji: '🥖', amountMillimes: 10000, category: 'groceries' },
];

type QuickExpenseBarProps = {
  favorites?: QuickFavorite[];
  onSelectFavorite: (favorite: QuickFavorite) => void;
};

export function QuickExpenseBar({ favorites = defaultFavorites, onSelectFavorite }: QuickExpenseBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="label">DAILY SHORTCUTS (1-TAP)</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {favorites.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Quick add ${item.label} for ${formatMoney(item.amountMillimes)}`}
            onPress={() => onSelectFavorite(item)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={styles.textContainer}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.amount}>{formatMoney(item.amountMillimes)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollList: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 18,
  },
  textContainer: {
    gap: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  amount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.expense,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: colors.surfaceMuted,
  },
});
