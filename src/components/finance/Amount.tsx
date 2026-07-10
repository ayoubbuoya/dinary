import { StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import { Text } from '@/components/ui/Text';
export function Amount({ millimes, type = 'neutral', size = 'body' }: { millimes: number; type?: 'income' | 'expense' | 'neutral'; size?: 'body' | 'large' }) { const signed = type === 'expense' ? -Math.abs(millimes) : type === 'income' ? Math.abs(millimes) : millimes; return <Text variant={size === 'large' ? 'amount' : 'body'} style={[styles[type], size === 'body' && styles.body]}>{formatMoney(signed, { sign: type !== 'neutral' })}</Text>; }
const styles = StyleSheet.create({ income: { color: colors.income }, expense: { color: colors.expense }, neutral: { color: colors.text }, body: { fontWeight: '700' } });
