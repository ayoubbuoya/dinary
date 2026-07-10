import { useRouter } from 'expo-router';
import { ArrowRight, Bot, CirclePlus, ReceiptText, WalletCards } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BalanceCard } from '@/components/finance/BalanceCard';
import { MonthSummaryCard } from '@/components/finance/MonthSummaryCard';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { VoiceButton } from '@/components/finance/VoiceButton';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { categoryFor } from '@/constants/categories';
import { colors, radius } from '@/constants/colors';
import { getLocalMonthKey, formatMonthYear, formatToday } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import { useTransactions } from '@/features/transactions/transaction-store';

export default function HomeScreen() {
  const router = useRouter();
  const { balanceMillimes, monthIncomeMillimes, monthExpenseMillimes, transactions, isLoading } = useTransactions();
  const now = new Date();
  const currentMonthExpenses = transactions.filter((transaction) => transaction.type === 'expense' && getLocalMonthKey(new Date(transaction.occurredAt)) === getLocalMonthKey(now));
  const categoryTotals = currentMonthExpenses.reduce<Record<string, number>>((totals, transaction) => ({ ...totals, [transaction.category]: (totals[transaction.category] ?? 0) + transaction.amountMillimes }), {});
  const topCategory = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first)[0];

  return <Screen>
    <View style={styles.header}><View><Text variant="caption">{formatToday(now)}</Text><Text variant="title">Dinary</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View></View>
    <View style={styles.intro}><Text variant="subtitle">Win yemchi dinarek?</Text><Text variant="caption">Your {formatMonthYear(now)} money overview</Text></View>
    <BalanceCard balanceMillimes={balanceMillimes} incomeMillimes={monthIncomeMillimes} expenseMillimes={monthExpenseMillimes} />
    <View style={styles.actions}><QuickAction label="Expense" Icon={CirclePlus} onPress={() => router.navigate('/add-transaction')} /><QuickAction label="Income" Icon={WalletCards} onPress={() => router.navigate('/add-transaction')} /><QuickAction label="Hsebli" Icon={Bot} onPress={() => router.navigate('/assistant')} /><VoiceButton compact onPress={() => router.navigate('/add-transaction')} /></View>
    <View style={styles.sectionHeader}><Text variant="subtitle">This month</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
      <MonthSummaryCard eyebrow="TOP CATEGORY" title={topCategory ? categoryFor(topCategory[0] as Parameters<typeof categoryFor>[0]).label : 'No expenses yet'} detail={topCategory ? `${formatMoney(topCategory[1])} spent` : 'Add an expense to see your spending.'} />
      <MonthSummaryCard eyebrow="SALARY" title="Not configured" detail="Set up an expected salary when ready." />
    </ScrollView>
    <View style={styles.sectionHeader}><Text variant="subtitle">Recent activity</Text><Pressable onPress={() => router.navigate('/transactions')} style={styles.viewAll}><Text style={styles.viewAllText}>See all</Text><ArrowRight size={16} color={colors.primary} /></Pressable></View>
    {isLoading ? <Text variant="caption">Loading your local data…</Text> : transactions.length === 0 ? <EmptyState title="No transactions yet" description="Add your first expense or income to start tracking your TND." action={<Pressable onPress={() => router.navigate('/add-transaction')}><Text style={styles.viewAllText}>Add transaction</Text></Pressable>} /> : <Card variant="default" style={styles.transactions}>{transactions.slice(0, 3).map((transaction, index) => <View key={transaction.id}>{index > 0 && <View style={styles.line} />}<TransactionItem transaction={transaction} /></View>)}</Card>}
    <Card variant="muted" style={styles.insight}><ReceiptText size={22} color={colors.accent} /><View style={styles.insightText}><Text style={styles.insightTitle}>A small insight</Text><Text variant="caption">{topCategory ? `${categoryFor(topCategory[0] as Parameters<typeof categoryFor>[0]).label} is your largest expense category this month.` : 'Insights will appear after you add transactions.'}</Text></View></Card>
  </Screen>;
}

function QuickAction({ label, Icon, onPress }: { label: string; Icon: typeof CirclePlus; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label}`} onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Icon size={21} color={colors.primary} /><Text variant="caption" style={styles.quickLabel}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, avatarText: { color: colors.primary, fontWeight: '800' }, intro: { gap: 2 }, actions: { flexDirection: 'row', gap: 9 }, quick: { flex: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, quickLabel: { fontSize: 11, color: colors.primary, fontWeight: '700' }, pressed: { opacity: .7 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 }, viewAllText: { color: colors.primary, fontWeight: '700' }, summaryScroll: { gap: 12, paddingRight: 20 }, transactions: { paddingVertical: 3 }, line: { height: 1, backgroundColor: colors.border, marginLeft: 54 }, insight: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, insightText: { flex: 1, gap: 3 }, insightTitle: { fontWeight: '800' } });
