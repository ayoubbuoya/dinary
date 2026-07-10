import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { VoiceButton } from '@/components/finance/VoiceButton';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import type { TransactionCategory, TransactionType } from '@/types/transaction';
export default function AddTransactionScreen() { const router = useRouter(); const [type, setType] = useState<TransactionType>('expense'); const [category, setCategory] = useState<TransactionCategory>('food'); return <Screen><View style={styles.header}><Text variant="title">Add transaction</Text><Text variant="caption">It stays a draft in this frontend preview.</Text></View><View style={styles.types}><Button variant={type === 'expense' ? 'danger' : 'secondary'} onPress={() => setType('expense')}>Expense</Button><Button variant={type === 'income' ? 'primary' : 'secondary'} onPress={() => setType('income')}>Income</Button></View><Input label="Amount" placeholder="0.000" prefix="TND" keyboardType="decimal-pad" /><View style={styles.section}><Text variant="label">CATEGORY</Text><View style={styles.chips}>{categories.filter((item) => type === 'income' ? item.id === 'salary' || item.id === 'other' : item.id !== 'salary').map((item) => <CategoryChip key={item.id} label={item.label} emoji={item.emoji} selected={category === item.id} onPress={() => setCategory(item.id)} />)}</View></View><Input label="Date" value="July 10, 2026" editable={false} /><Input label="Note (optional)" placeholder="What was this for?" /><VoiceButton /><Button size="lg" onPress={() => { Alert.alert('Saved as a preview', 'Your transaction was not stored.'); router.back(); }}>Save transaction</Button></Screen>; }
const styles = StyleSheet.create({ header: { gap: 4 }, types: { flexDirection: 'row', gap: 10 }, section: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
