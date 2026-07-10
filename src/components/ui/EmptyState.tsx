import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/colors';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card variant="muted" style={styles.card}><View style={styles.copy}><Text variant="subtitle">{title}</Text><Text variant="caption" style={styles.description}>{description}</Text></View>{action}</Card>;
}

const styles = StyleSheet.create({ card: { alignItems: 'center', gap: 14, paddingVertical: 24 }, copy: { alignItems: 'center', gap: 6 }, description: { textAlign: 'center', color: colors.textMuted } });
