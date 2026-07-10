import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionDateInput } from '@/components/finance/TransactionDateInput';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { formatMoney } from '@/lib/format-money';
import { parseTndToMillimes } from '@/lib/parse-money';
import { useTransactions } from '@/features/transactions/transaction-store';
import type { Transaction, TransactionCategory } from '@/types/transaction';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, isLoading } = useTransactions();
  const transaction = transactions.find((item) => item.id === id);

  if (isLoading) return <Screen><Text variant="caption">Loading transaction…</Text></Screen>;
  if (!transaction) return <Screen><EmptyState title="Transaction unavailable" description="It may have been deleted or is no longer part of this local wallet." /></Screen>;
  return <EditTransactionForm key={transaction.id} transaction={transaction} />;
}

function EditTransactionForm({ transaction }: { transaction: Transaction }) {
  const router = useRouter();
  const { updateTransaction, deleteTransaction } = useTransactions();
  const [type, setType] = useState<'income' | 'expense'>(transaction.type === 'income' ? 'income' : 'expense');
  const [category, setCategory] = useState<TransactionCategory>(transaction.category);
  const [amount, setAmount] = useState(String(transaction.amountMillimes / 1000));
  const [note, setNote] = useState(transaction.note ?? '');
  const [occurredAt, setOccurredAt] = useState(() => new Date(transaction.occurredAt));
  const [amountError, setAmountError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const changeType = (nextType: 'income' | 'expense') => {
    setType(nextType);
    if (nextType === 'income' && category !== 'salary' && category !== 'other') setCategory('salary');
    if (nextType === 'expense' && category === 'salary') setCategory('food');
  };

  const saveTransaction = async () => {
    const amountMillimes = parseTndToMillimes(amount);
    if (!amountMillimes) { setAmountError('Enter an amount with up to three decimal places.'); return; }
    setIsSaving(true);
    try {
      await updateTransaction(transaction.id, { type, amountMillimes, category, note, occurredAt: occurredAt.toISOString() });
      router.replace('/transactions');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => Alert.alert('Delete transaction?', `${transaction.title} (${formatMoney(transaction.amountMillimes)}) will be removed from your balance and analytics.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void removeTransaction() },
  ]);

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

  return <Screen><View style={styles.header}><Text variant="title">Edit transaction</Text><Text variant="caption">Changes are saved only on this device.</Text></View><View style={styles.types}><Button variant={type === 'expense' ? 'danger' : 'secondary'} onPress={() => changeType('expense')}>Expense</Button><Button variant={type === 'income' ? 'primary' : 'secondary'} onPress={() => changeType('income')}>Income</Button></View><Input label="Amount" placeholder="0.000" prefix="TND" keyboardType="decimal-pad" value={amount} onChangeText={(value) => { setAmount(value); setAmountError(undefined); }} error={amountError} /><View style={styles.section}><Text variant="label">CATEGORY</Text><View style={styles.chips}>{categories.filter((item) => type === 'income' ? item.id === 'salary' || item.id === 'other' : item.id !== 'salary').map((item) => <CategoryChip key={item.id} label={item.label} emoji={item.emoji} selected={category === item.id} onPress={() => setCategory(item.id)} />)}</View></View><TransactionDateInput value={occurredAt} onChange={setOccurredAt} /><Input label="Note (optional)" placeholder="What was this for?" value={note} onChangeText={setNote} /><Button size="lg" loading={isSaving} disabled={isDeleting} onPress={() => void saveTransaction()}>Save changes</Button><Button variant="danger" loading={isDeleting} disabled={isSaving} onPress={confirmDelete}>Delete transaction</Button></Screen>;
}

const styles = StyleSheet.create({ header: { gap: 4 }, types: { flexDirection: 'row', gap: 10 }, section: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
