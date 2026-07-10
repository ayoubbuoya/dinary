import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { formatTransactionDate } from '@/lib/format-date';
import { useTransactions } from '@/features/transactions/transaction-store';
export default function TransactionsScreen() { const { transactions } = useTransactions(); const groupedTransactions = Object.values(transactions.reduce<Record<string, typeof transactions>>((groups, transaction) => { const key = new Date(transaction.occurredAt).toDateString(); groups[key] = [...(groups[key] ?? []), transaction]; return groups; }, {})); return <Screen><View style={styles.header}><Text variant="title">Transactions</Text><Text variant="caption">July 2026 · All accounts</Text></View><View style={styles.filter}><Text variant="label">FILTER BY CATEGORY</Text><View style={styles.chips}>{categories.slice(0, 5).map((category, index) => <CategoryChip key={category.id} label={category.label} emoji={category.emoji} selected={index === 0} />)}</View></View>{groupedTransactions.map((group) => <View key={group[0].id} style={styles.group}><Text variant="label">{formatTransactionDate(group[0].occurredAt).toUpperCase()}</Text><Card style={styles.list}>{group.map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} />)}</Card></View>)}</Screen>; }
const styles = StyleSheet.create({ header: { gap: 4 }, filter: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, group: { gap: 8 }, list: { paddingVertical: 3 } });
