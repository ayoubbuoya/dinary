import { StyleSheet, View } from 'react-native';
import { categoryFor } from '@/constants/categories';
import { formatTransactionDate } from '@/lib/format-date';
import type { Transaction } from '@/types/transaction';
import { Text } from '@/components/ui/Text';
import { Amount } from './Amount';
import { colors } from '@/constants/colors';
export function TransactionItem({ transaction }: { transaction: Transaction }) { const category = categoryFor(transaction.category); return <View style={styles.row}><View style={styles.icon}><Text>{category.emoji}</Text></View><View style={styles.details}><Text style={styles.title}>{transaction.title}</Text><Text variant="caption">{transaction.note ? `${transaction.note} · ` : ''}{formatTransactionDate(transaction.occurredAt)}</Text></View><Amount millimes={transaction.amountMillimes} type={transaction.type === 'transfer' ? 'neutral' : transaction.type} /></View>; }
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, details: { flex: 1, gap: 2 }, title: { fontWeight: '700' } });
