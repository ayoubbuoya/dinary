import { StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/colors';
export function MonthSummaryCard({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <Card variant="muted" style={styles.card}><Text variant="label" style={styles.eyebrow}>{eyebrow}</Text><Text variant="subtitle">{title}</Text><Text variant="caption">{detail}</Text></Card>; }
const styles = StyleSheet.create({ card: { width: 210, gap: 6 }, eyebrow: { color: colors.accent } });
