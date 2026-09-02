import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionDateInput } from '@/components/finance/TransactionDateInput';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { parseTndToMillimes } from '@/lib/parse-money';
import { useTransactions } from '@/features/transactions/transaction-store';
import type { Transaction, TransactionCategory } from '@/types/transaction';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, isLoading } = useTransactions();
  const transaction = transactions.find((item) => item.id === id);

  if (isLoading) {
    return (
      <Screen>
        <Text variant="caption">Loading transaction…</Text>
      </Screen>
    );
  }

  if (!transaction) {
    return (
      <Screen>
        <EmptyState
          title="Transaction unavailable"
          description="It may have been deleted or is no longer part of this local wallet."
        />
      </Screen>
    );
  }

  return <EditTransactionForm key={transaction.id} transaction={transaction} />;
}

function EditTransactionForm({ transaction }: { transaction: Transaction }) {
  const router = useRouter();
  const { updateTransaction, deleteTransaction, accounts } = useTransactions();
  const [type, setType] = useState<'income' | 'expense'>(
    transaction.type === 'income' ? 'income' : 'expense',
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(transaction.accountId || 'cash');
  const [category, setCategory] = useState<TransactionCategory>(transaction.category);
  const [amount, setAmount] = useState(String(transaction.amountMillimes / 1000));
  const [note, setNote] = useState(transaction.note ?? '');
  const [occurredAt, setOccurredAt] = useState(() => new Date(transaction.occurredAt));
  const [amountError, setAmountError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isTransfer = transaction.type === 'transfer';

  const changeType = (nextType: 'income' | 'expense') => {
    setType(nextType);
    if (nextType === 'income' && category !== 'salary' && category !== 'other') setCategory('salary');
    if (nextType === 'expense' && category === 'salary') setCategory('food');
  };

  const saveTransaction = async () => {
    const amountMillimes = parseTndToMillimes(amount);
    if (!amountMillimes) {
      setAmountError('Enter an amount with up to three decimal places.');
      return;
    }
    setIsSaving(true);
    try {
      await updateTransaction(transaction.id, {
        accountId: selectedAccountId,
        type,
        amountMillimes,
        category,
        note,
        occurredAt: occurredAt.toISOString(),
      });
      router.replace('/transactions');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    const message = isTransfer
      ? `Deleting this transfer (${formatMoney(transaction.amountMillimes)}) will remove both legs of the transfer across accounts.`
      : `${transaction.title} (${formatMoney(transaction.amountMillimes)}) will be removed from your balance and analytics.`;

    Alert.alert('Delete transaction?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeTransaction() },
    ]);
  };

  const removeTransaction = async () => {
    setIsDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      router.replace('/transactions');
    } catch (error) {
      Alert.alert('Delete failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{isTransfer ? 'Transfer details' : 'Edit transaction'}</Text>
        <Text variant="caption">Changes are saved only on this device.</Text>
      </View>

      {isTransfer ? (
        <Card variant="muted" style={styles.transferCard}>
          <View style={styles.transferHeader}>
            <ArrowLeftRight size={22} color={colors.primary} />
            <Text style={styles.transferTitle}>{transaction.title}</Text>
          </View>
          <Text style={styles.transferAmount}>{formatMoney(transaction.amountMillimes)}</Text>
          {transaction.note ? <Text variant="caption">Note: {transaction.note}</Text> : null}
          <Text variant="caption">
            Transfers update individual account balances without altering spending totals.
          </Text>
        </Card>
      ) : (
        <>
          <View style={styles.types}>
            <Button variant={type === 'expense' ? 'danger' : 'secondary'} onPress={() => changeType('expense')}>
              Expense
            </Button>
            <Button variant={type === 'income' ? 'primary' : 'secondary'} onPress={() => changeType('income')}>
              Income
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
            }}
            error={amountError}
          />

          {/* Account Selector */}
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

          <View style={styles.section}>
            <Text variant="label">CATEGORY</Text>
            <View style={styles.chips}>
              {categories
                .filter((item) => (type === 'income' ? item.id === 'salary' || item.id === 'other' : item.id !== 'salary'))
                .map((item) => (
                  <CategoryChip
                    key={item.id}
                    label={item.label}
                    emoji={item.emoji}
                    selected={category === item.id}
                    onPress={() => setCategory(item.id)}
                  />
                ))}
            </View>
          </View>

          <TransactionDateInput value={occurredAt} onChange={setOccurredAt} />

          <Input label="Note (optional)" placeholder="What was this for?" value={note} onChangeText={setNote} />

          <Button size="lg" loading={isSaving} disabled={isDeleting} onPress={() => void saveTransaction()}>
            Save changes
          </Button>
        </>
      )}

      <Button variant="danger" loading={isDeleting} disabled={isSaving} onPress={confirmDelete}>
        {isTransfer ? 'Delete transfer' : 'Delete transaction'}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  types: { flexDirection: 'row', gap: 8 },
  section: { gap: 8 },
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
  transferCard: { gap: 10, padding: 16 },
  transferHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  transferAmount: { fontSize: 24, fontWeight: '900', color: colors.primary },
});

