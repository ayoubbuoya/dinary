import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionDateInput } from '@/components/finance/TransactionDateInput';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { colors, radius } from '@/constants/colors';
import type { TransactionCategory, TransactionType } from '@/types/transaction';
import { useTransactions } from '@/features/transactions/transaction-store';
import { parseTndToMillimes } from '@/lib/parse-money';

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    amount?: string;
    category?: string;
    note?: string;
    accountId?: string;
  }>();

  const { addTransaction, addTransfer, accounts } = useTransactions();

  const initialType: TransactionType =
    params.type === 'income' || params.type === 'transfer' ? params.type : 'expense';

  const [type, setType] = useState<TransactionType>(initialType);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(params.accountId || 'cash');
  const [fromAccountId, setFromAccountId] = useState<string>('bank_card');
  const [toAccountId, setToAccountId] = useState<string>('cash');
  const [category, setCategory] = useState<TransactionCategory>(
    (params.category as TransactionCategory) || (initialType === 'income' ? 'salary' : 'food'),
  );
  const [amount, setAmount] = useState(params.amount || '');
  const [note, setNote] = useState(params.note || '');
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [amountError, setAmountError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    setFormError(undefined);
    if (nextType === 'income' && category !== 'salary' && category !== 'other') {
      setCategory('salary');
    } else if (nextType === 'expense' && category === 'salary') {
      setCategory('food');
    }
  };

  const saveRecord = async () => {
    const amountMillimes = parseTndToMillimes(amount);
    if (!amountMillimes) {
      setAmountError('Enter an amount with up to three decimal places.');
      return;
    }

    if (type === 'transfer') {
      if (fromAccountId === toAccountId) {
        setFormError('Source account and destination account cannot be the same.');
        return;
      }

      setIsSaving(true);
      try {
        await addTransfer({
          fromAccountId,
          toAccountId,
          amountMillimes,
          note,
          occurredAt: occurredAt.toISOString(),
        });
        router.replace('/transactions');
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Transfer could not be saved.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Income / Expense flow
    if (!category) {
      setFormError('Choose a category before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await addTransaction({
        accountId: selectedAccountId,
        type: type as 'income' | 'expense',
        amountMillimes,
        category,
        note,
        occurredAt: occurredAt.toISOString(),
      });
      router.replace('/transactions');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Transaction could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Add transaction</Text>
        <Text variant="caption">Saved privately on this device.</Text>
      </View>

      {/* 3-way Type Switcher */}
      <View style={styles.types}>
        <Button
          variant={type === 'expense' ? 'danger' : 'secondary'}
          onPress={() => changeType('expense')}
        >
          Expense
        </Button>
        <Button
          variant={type === 'income' ? 'primary' : 'secondary'}
          onPress={() => changeType('income')}
        >
          Income
        </Button>
        <Button
          variant={type === 'transfer' ? 'primary' : 'secondary'}
          onPress={() => changeType('transfer')}
        >
          Transfer
        </Button>
      </View>

      <Input
        label="Amount"
        placeholder="0.000"
        prefix="TND"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          setAmountError(undefined);
          setFormError(undefined);
        }}
        error={amountError}
      />

      {type === 'transfer' ? (
        <View style={styles.transferSection}>
          <View style={styles.section}>
            <Text variant="label">FROM ACCOUNT (SOURCE)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
              {accounts.map((acc) => (
                <Pressable
                  key={acc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Transfer from ${acc.name}`}
                  onPress={() => {
                    setFromAccountId(acc.id);
                    setFormError(undefined);
                  }}
                  style={[
                    styles.accountChip,
                    fromAccountId === acc.id && styles.accountChipSelected,
                  ]}
                >
                  <Text style={styles.accountEmoji}>{acc.emoji}</Text>
                  <Text style={[styles.accountName, fromAccountId === acc.id && styles.accountNameSelected]}>
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text variant="label">TO ACCOUNT (DESTINATION)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
              {accounts.map((acc) => (
                <Pressable
                  key={acc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Transfer to ${acc.name}`}
                  onPress={() => {
                    setToAccountId(acc.id);
                    setFormError(undefined);
                  }}
                  style={[
                    styles.accountChip,
                    toAccountId === acc.id && styles.accountChipSelected,
                  ]}
                >
                  <Text style={styles.accountEmoji}>{acc.emoji}</Text>
                  <Text style={[styles.accountName, toAccountId === acc.id && styles.accountNameSelected]}>
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          {/* Account selector */}
          <View style={styles.section}>
            <Text variant="label">ACCOUNT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
              {accounts.map((acc) => (
                <Pressable
                  key={acc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Account ${acc.name}`}
                  onPress={() => setSelectedAccountId(acc.id)}
                  style={[
                    styles.accountChip,
                    selectedAccountId === acc.id && styles.accountChipSelected,
                  ]}
                >
                  <Text style={styles.accountEmoji}>{acc.emoji}</Text>
                  <Text style={[styles.accountName, selectedAccountId === acc.id && styles.accountNameSelected]}>
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Category Chips */}
          <View style={styles.section}>
            <Text variant="label">CATEGORY</Text>
            <View style={styles.chips}>
              {categories
                .filter((item) =>
                  type === 'income'
                    ? item.id === 'salary' || item.id === 'other'
                    : item.id !== 'salary',
                )
                .map((item) => (
                  <CategoryChip
                    key={item.id}
                    label={item.label}
                    emoji={item.emoji}
                    selected={category === item.id}
                    onPress={() => {
                      setCategory(item.id);
                      setFormError(undefined);
                    }}
                  />
                ))}
            </View>
          </View>
        </>
      )}

      {formError && <Text variant="caption" style={styles.formError}>{formError}</Text>}

      <TransactionDateInput value={occurredAt} onChange={setOccurredAt} />

      <Input
        label="Note (optional)"
        placeholder={type === 'transfer' ? 'e.g. ATM withdrawal / Distributeur' : 'What was this for?'}
        value={note}
        onChangeText={setNote}
      />

      <Button size="lg" loading={isSaving} onPress={() => void saveRecord()}>
        {type === 'transfer' ? 'Save transfer' : 'Save transaction'}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  types: { flexDirection: 'row', gap: 8 },
  section: { gap: 8 },
  transferSection: { gap: 14 },
  accountChips: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  accountEmoji: { fontSize: 14 },
  accountName: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  accountNameSelected: { color: colors.primaryDark, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formError: { color: colors.expense, fontWeight: '600' },
});
