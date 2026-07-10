import { usePathname, useRouter } from 'expo-router';
import { Bot, CirclePlus, House, ReceiptText } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';
import { Text } from '@/components/ui/Text';
const items = [{ label: 'Home', href: '/', Icon: House }, { label: 'Transactions', href: '/transactions', Icon: ReceiptText }, { label: 'Add', href: '/add-transaction', Icon: CirclePlus }, { label: 'Hsebli', href: '/assistant', Icon: Bot }] as const;
export function BottomNavigation() { const router = useRouter(); const pathname = usePathname(); return <View style={styles.bar}>{items.map(({ label, href, Icon }) => { const active = pathname === href; return <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.navigate(href)} style={styles.item}><Icon size={21} color={active ? colors.primary : colors.textMuted} strokeWidth={active ? 2.6 : 2} /><Text variant="caption" style={[styles.label, active && styles.active]}>{label}</Text></Pressable>; })}</View>; }
const styles = StyleSheet.create({ bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingTop: 10, paddingBottom: 18 }, item: { minWidth: 66, minHeight: 44, alignItems: 'center', gap: 3 }, label: { fontSize: 11 }, active: { color: colors.primary, fontWeight: '700' } });
