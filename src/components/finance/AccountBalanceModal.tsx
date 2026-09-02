import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Check, Wallet, X } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { parseTndToMillimes } from '@/lib/parse-money';
import type { Account } from '@/types/account';

type AccountBalanceModalProps = {
  visible: boolean;
  accounts: Account[];
  onClose: () => void;
  onSave: (balances: Record<string, number>) => Promise<void>;
};

export function AccountBalanceModal({
  visible,
  accounts,
  onClose,
  onSave,
}: AccountBalanceModalProps) {
  // Map account initial amounts into string inputs in TND
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const acc of accounts) {
      initial[acc.id] = acc.openingBalanceMillimes > 0 ? String(acc.openingBalanceMillimes / 1000) : '';
    }
    return initial;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Compute live preview of total starting net worth
  let totalStartingMillimes = 0;
  for (const acc of accounts) {
    const millimes = parseTndToMillimes(inputs[acc.id] ?? '') ?? 0;
    totalStartingMillimes += millimes;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const balanceMap: Record<string, number> = {};
      for (const acc of accounts) {
        const millimes = parseTndToMillimes(inputs[acc.id] ?? '') ?? 0;
        balanceMap[acc.id] = millimes;
      }
      await onSave(balanceMap);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconContainer}>
                <Wallet size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Initial Account Balances</Text>
                <Text variant="caption">Set your starting money across your accounts.</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close starting balance modal" onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Card variant="muted" style={styles.previewCard}>
            <Text variant="caption">TOTAL STARTING NET WORTH</Text>
            <Text style={styles.previewAmount}>{formatMoney(totalStartingMillimes)}</Text>
          </Card>

          <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
            {accounts.map((acc) => (
              <View key={acc.id} style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountEmoji}>{acc.emoji}</Text>
                  <View>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text variant="caption">Starting balance</Text>
                  </View>
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>TND</Text>
                  <TextInput
                    placeholder="0.000"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="decimal-pad"
                    value={inputs[acc.id] ?? ''}
                    onChangeText={(val) => setInputs((prev) => ({ ...prev, [acc.id]: val }))}
                    style={styles.inputField}
                  />
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button size="lg" loading={isSaving} onPress={() => void handleSave()}>
              <Check size={18} color={colors.white} style={styles.btnIcon} />
              Save starting balances
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    maxHeight: '85%',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  previewCard: {
    padding: 14,
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  previewAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  accountsList: {
    maxHeight: 280,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountEmoji: {
    fontSize: 22,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    width: 130,
    height: 40,
  },
  currencyPrefix: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: 6,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  actions: {
    marginTop: 4,
  },
  btnIcon: {
    marginRight: 6,
  },
});
