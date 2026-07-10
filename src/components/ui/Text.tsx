import type { ComponentProps } from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import { colors } from '@/constants/colors';

type Props = ComponentProps<typeof NativeText> & { variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'label' | 'amount' };
export function Text({ variant = 'body', style, ...props }: Props) { return <NativeText {...props} style={[styles.base, styles[variant], style]} />; }
const styles = StyleSheet.create({ base: { color: colors.text }, title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 }, subtitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' }, body: { fontSize: 16, lineHeight: 23 }, caption: { fontSize: 13, lineHeight: 18, color: colors.textMuted }, label: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.textMuted }, amount: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4 } });
