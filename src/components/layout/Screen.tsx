import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
export function Screen({ children, scroll = true, style, ...props }: PropsWithChildren<ViewProps & { scroll?: boolean }>) { const content = <View {...props} style={[styles.content, style]}>{children}</View>; return <SafeAreaView style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, scroll: { paddingBottom: 104 }, content: { paddingHorizontal: 20, paddingTop: 18, gap: 20 } });
