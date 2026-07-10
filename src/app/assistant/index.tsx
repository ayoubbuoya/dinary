import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bot, Send } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/colors';
import { getLocalMonthKey } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import { useTransactions } from '@/features/transactions/transaction-store';

const questions = ['Where did my money go this month?', 'Can I spend 50 TND today?', 'What category is growing too much?', 'How much did I spend on food?'];

export default function AssistantScreen() {
  const [question, setQuestion] = useState('');
  const { transactions } = useTransactions();
  const currentMonthFoodSpend = transactions.filter((transaction) => transaction.type === 'expense' && transaction.category === 'food' && getLocalMonthKey(new Date(transaction.occurredAt)) === getLocalMonthKey(new Date())).reduce((total, transaction) => total + transaction.amountMillimes, 0);

  return <Screen><View style={styles.hero}><View style={styles.bot}><Bot color={colors.primary} size={28} /></View><View style={styles.heroCopy}><Text variant="title">Hsebli</Text><Text variant="caption">Your private money companion · Coming soon</Text></View></View><Card variant="muted" style={styles.message}><Text style={styles.messageTitle}>Hello.</Text><Text variant="body">I’ll explain your local financial facts once the assistant is connected. No financial data is sent anywhere.</Text></Card><View style={styles.section}><Text variant="label">TRY ASKING</Text><View style={styles.questions}>{questions.map((item) => <Button key={item} variant="secondary" size="sm" onPress={() => setQuestion(item)}>{item}</Button>)}</View></View><View style={styles.section}><Text variant="label">CURRENT FACT</Text><Card style={styles.answer}><Text variant="body">{currentMonthFoodSpend > 0 ? <>You have recorded <Text style={styles.strong}>{formatMoney(currentMonthFoodSpend)}</Text> in food spending this month.</> : 'No food expenses have been recorded this month yet.'}</Text></Card></View><View style={styles.ask}><Input label="Ask Hsebli" placeholder="Type a question…" value={question} onChangeText={setQuestion} /><Button accessibilityLabel="Send question" onPress={() => setQuestion('')}><Send size={18} color={colors.white} /></Button></View></Screen>;
}
const styles = StyleSheet.create({ hero: { flexDirection: 'row', alignItems: 'center', gap: 12 }, bot: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }, heroCopy: { gap: 2 }, message: { gap: 8 }, messageTitle: { fontWeight: '800' }, section: { gap: 10 }, questions: { alignItems: 'flex-start', gap: 8 }, answer: { borderLeftWidth: 4, borderLeftColor: colors.primary }, strong: { fontWeight: '800', color: colors.primary }, ask: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 } });
