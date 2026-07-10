import { Alert, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/colors';
export default function SalaryScreen() { return <Screen><View style={styles.header}><Text variant="title">Salary setup</Text><Text variant="caption">Plan your expected income without adding it to your balance yet.</Text></View><Input label="Monthly salary" placeholder="1,500.000" prefix="TND" keyboardType="decimal-pad" /><Input label="Expected day of month" value="3" keyboardType="number-pad" /><Input label="Label" value="Monthly salary" /><Card variant="muted" style={styles.note}><Text style={styles.noteTitle}>Previous-month salary</Text><Text variant="caption">If you receive June’s salary on July 3, it appears as expected until you confirm it. Expected income is never part of your actual balance.</Text></Card><Button size="lg" onPress={() => Alert.alert('Preview saved', 'Salary setup is static in this frontend foundation.')}>Save salary rule</Button></Screen>; }
const styles = StyleSheet.create({ header: { gap: 4 }, note: { gap: 5, borderLeftWidth: 4, borderLeftColor: colors.accent }, noteTitle: { fontWeight: '800' } });
