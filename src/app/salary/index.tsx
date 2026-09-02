import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, CheckCircle2, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { parseTndToMillimes } from '@/lib/parse-money';
import { useTransactions } from '@/features/transactions/transaction-store';
import { getNextPayday, getDaysUntilPayday } from '@/lib/salary';
import type { RecurringRule } from '@/types/recurring';
import type { Account } from '@/types/account';

export default function SalaryScreen() {
  const { salaryRule, accounts, transactions, saveSalaryRule, deleteSalaryRule } = useTransactions();

  const salaryHistory = transactions.filter(
    (t) => t.type === 'income' && t.category === 'salary',
  );

  const daysRemaining = salaryRule ? getDaysUntilPayday(salaryRule.dayOfMonth) : undefined;
  const nextPayday = salaryRule ? getNextPayday(salaryRule.dayOfMonth) : undefined;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Salary setup</Text>
        <Text variant="caption">Plan your expected income without adding it to your balance yet.</Text>
      </View>

      {salaryRule && nextPayday && (
        <Card variant="muted" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Calendar size={18} color={colors.primary} />
            <Text style={styles.statusTitle}>Next Expected Payday</Text>
          </View>
          <Text style={styles.statusDetail}>
            {nextPayday.toLocaleDateString('en-TN', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            <Text style={styles.daysHighlight}>
              {daysRemaining === 0 ? 'Today 🎉' : `in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}
            </Text>
          </Text>
        </Card>
      )}

      <SalaryForm
        key={salaryRule?.id ?? 'none'}
        salaryRule={salaryRule}
        accounts={accounts}
        onSave={saveSalaryRule}
        onDelete={deleteSalaryRule}
      />

      {/* Past Salary History */}
      {salaryHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <CheckCircle2 size={18} color={colors.primary} />
            <Text variant="subtitle">Salary confirmation history</Text>
          </View>
          <Card variant="default" style={styles.historyList}>
            {salaryHistory.map((t, idx) => (
              <View key={t.id}>
                {idx > 0 && <View style={styles.line} />}
                <TransactionItem transaction={t} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

type SalaryFormProps = {
  salaryRule?: RecurringRule;
  accounts: Account[];
  onSave: (input: Parameters<ReturnType<typeof useTransactions>['saveSalaryRule']>[0]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function SalaryForm({ salaryRule, accounts, onSave, onDelete }: SalaryFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(() => (salaryRule ? String(salaryRule.amountMillimes / 1000) : ''));
  const [dayOfMonth, setDayOfMonth] = useState(() => (salaryRule ? String(salaryRule.dayOfMonth) : '25'));
  const [description, setDescription] = useState(() => (salaryRule ? salaryRule.description : 'Monthly salary'));
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => salaryRule?.accountId ?? 'bank_card');
  const [amountError, setAmountError] = useState<string>();
  const [dayError, setDayError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    const amountMillimes = parseTndToMillimes(amount);
    if (!amountMillimes || amountMillimes <= 0) {
      setAmountError('Enter a valid monthly salary amount.');
      return;
    }

    const dayNum = parseInt(dayOfMonth, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setDayError('Enter a valid day of month between 1 and 31.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        amountMillimes,
        accountId: selectedAccountId,
        dayOfMonth: dayNum,
        description: description.trim() || 'Monthly salary',
        isActive: true,
      });
      Alert.alert(
        'Salary Rule Saved',
        `Expected salary of ${formatMoney(amountMillimes)} on day ${dayNum} is now configured.`,
        [{ text: 'OK', onPress: () => router.navigate('/') }],
      );
    } catch (error) {
      Alert.alert('Save Failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!salaryRule) return;
    Alert.alert(
      'Remove Salary Rule?',
      'This will remove your recurring salary rule and payday countdown. Past recorded salary transactions will remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete(salaryRule.id);
              Alert.alert('Rule Removed', 'Your salary rule has been removed.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.formContainer}>
      <Input
        label="Monthly salary amount"
        placeholder="0.000"
        prefix="TND"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(val) => {
          setAmount(val);
          setAmountError(undefined);
        }}
        error={amountError}
      />

      <Input
        label="Expected day of month (1–31)"
        placeholder="e.g. 25 or 3"
        keyboardType="number-pad"
        value={dayOfMonth}
        onChangeText={(val) => {
          setDayOfMonth(val);
          setDayError(undefined);
        }}
        error={dayError}
      />

      {/* Target Account Selector */}
      <View style={styles.section}>
        <Text variant="label">DEPOSIT TO ACCOUNT</Text>
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

      <Input
        label="Label"
        placeholder="Monthly salary"
        value={description}
        onChangeText={setDescription}
      />

      <Card variant="muted" style={styles.note}>
        <Text style={styles.noteTitle}>Tunisian Salary Behavior</Text>
        <Text variant="caption">
          Expected income stays separate from your actual balance until you confirm it as received. On payday, you will receive a 1-tap confirmation prompt.
        </Text>
      </Card>

      <Button size="lg" loading={isSaving} disabled={isDeleting} onPress={() => void handleSave()}>
        {salaryRule ? 'Update salary rule' : 'Save salary rule'}
      </Button>

      {salaryRule && (
        <Button
          variant="danger"
          loading={isDeleting}
          disabled={isSaving}
          onPress={confirmDelete}
        >
          <Trash2 size={16} color={colors.expense} style={styles.deleteIcon} />
          Remove salary rule
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  formContainer: { gap: 16 },
  statusCard: { gap: 6, padding: 14, backgroundColor: colors.primarySoft, borderColor: colors.primary },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTitle: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  statusDetail: { fontSize: 15, fontWeight: '800', color: colors.text },
  daysHighlight: { color: colors.primaryDark, fontWeight: '800' },
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
  note: { gap: 5, borderLeftWidth: 4, borderLeftColor: colors.accent },
  noteTitle: { fontWeight: '800' },
  deleteIcon: { marginRight: 6 },
  historySection: { gap: 10, marginTop: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyList: { paddingVertical: 3 },
  line: { height: 1, backgroundColor: colors.border, marginLeft: 54 },
});
