import { Alert, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/colors';
export default function SalaryScreen() { return <Screen><View style={styles.header}><Text variant="title">Salary setup</Text><Text variant="caption">Plan your expected income without adding it to your balance yet.</Text></View><Input label="Monthly salary" placeholder="0.000" prefix="TND" keyboardType="decimal-pad" /><Input label="Expected day of month" placeholder="1–31" keyboardType="number-pad" /><Input label="Label" placeholder="Monthly salary" /><Card variant="muted" style={styles.note}><Text style={styles.noteTitle}>Previous-month salary</Text><Text variant="caption">Expected income stays separate from your actual balance until you confirm it as received.</Text></Card><Button size="lg" onPress={() => Alert.alert('Not configured yet', 'Salary rules will be saved to your local database in the next step.')}>Save salary rule</Button></Screen>; }
const styles = StyleSheet.create({ header: { gap: 4 }, note: { gap: 5, borderLeftWidth: 4, borderLeftColor: colors.accent }, noteTitle: { fontWeight: '800' } });
