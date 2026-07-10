import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { mockTransactions } from '@/constants/mock-data';
export default function TransactionsScreen() { return <Screen><View style={styles.header}><Text variant="title">Transactions</Text><Text variant="caption">July 2026 · All accounts</Text></View><View style={styles.filter}><Text variant="label">FILTER BY CATEGORY</Text><View style={styles.chips}>{categories.slice(0, 5).map((category, index) => <CategoryChip key={category.id} label={category.label} emoji={category.emoji} selected={index === 0} />)}</View></View><Text variant="label">TODAY · JULY 10</Text><Card style={styles.list}>{mockTransactions.filter((transaction) => transaction.occurredAt.startsWith('2026-07-10')).map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} />)}</Card><Text variant="label">EARLIER THIS MONTH</Text><Card style={styles.list}>{mockTransactions.filter((transaction) => !transaction.occurredAt.startsWith('2026-07-10')).map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} />)}</Card></Screen>; }
const styles = StyleSheet.create({ header: { gap: 4 }, filter: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, list: { paddingVertical: 3 } });
