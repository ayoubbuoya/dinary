import { Mic } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/colors';
import { Text } from '@/components/ui/Text';
export function VoiceButton({ onPress, compact = false }: { onPress?: () => void; compact?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel="Voice entry, coming soon" onPress={onPress} style={({ pressed }) => [styles.button, compact && styles.compact, pressed && styles.pressed]}><View style={styles.icon}><Mic color={colors.primary} size={20} /></View>{!compact && <View><Text style={styles.title}>Voice entry</Text><Text variant="caption">Coming soon</Text></View>}</Pressable>; }
const styles = StyleSheet.create({ button: { minHeight: 56, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, compact: { width: 56, justifyContent: 'center' }, icon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }, title: { fontWeight: '700', color: colors.primary }, pressed: { opacity: .75 } });
