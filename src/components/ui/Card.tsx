import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius } from '@/constants/colors';
export function Card({ variant = 'default', style, children, ...props }: PropsWithChildren<ViewProps & { variant?: 'default' | 'elevated' | 'muted' | 'outline' }>) { return <View {...props} style={[styles.base, styles[variant], style]}>{children}</View>; }
const styles = StyleSheet.create({ base: { borderRadius: radius.md, padding: 16 }, default: { backgroundColor: colors.surface }, elevated: { backgroundColor: colors.surface, shadowColor: colors.black, shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, muted: { backgroundColor: colors.surfaceMuted }, outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
