import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';

type PeriodNavigatorProps = {
  /** Visible period name, for example "October 2026" or "2026". */
  label: string;
  /** Unit used in accessibility labels, for example "month" or "year". */
  unit: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /** Shown as a small "Today" style shortcut when the user is not on the current period. */
  resetLabel?: string;
  onReset?: () => void;
};

/** Previous / next arrows around a period label, used to browse past months and years. */
export function PeriodNavigator({ label, unit, canGoBack, canGoForward, onBack, onForward, resetLabel, onReset }: PeriodNavigatorProps) {
  return (
    <View style={styles.row}>
      <ArrowButton direction="back" unit={unit} disabled={!canGoBack} onPress={onBack} />
      <View style={styles.center}>
        <Text style={styles.label} accessibilityRole="header">{label}</Text>
        {resetLabel && onReset ? (
          <Pressable accessibilityRole="button" accessibilityLabel={resetLabel} onPress={onReset} hitSlop={8} style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
            <Text style={styles.resetText}>{resetLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ArrowButton direction="forward" unit={unit} disabled={!canGoForward} onPress={onForward} />
    </View>
  );
}

function ArrowButton({ direction, unit, disabled, onPress }: { direction: 'back' | 'forward'; unit: string; disabled: boolean; onPress: () => void }) {
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? `Previous ${unit}` : `Next ${unit}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, disabled && styles.arrowDisabled, pressed && styles.pressed]}
    >
      <Icon size={20} color={disabled ? colors.textSoft : colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4 },
  center: { flex: 1, alignItems: 'center', gap: 1 },
  label: { fontSize: 15, fontWeight: '800', color: colors.text },
  reset: { paddingHorizontal: 8, paddingVertical: 1 },
  resetText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  arrow: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  arrowDisabled: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.7 },
});
