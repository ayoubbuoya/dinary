import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
export function Screen({ children, scroll = true, style, ...props }: PropsWithChildren<ViewProps & { scroll?: boolean }>) { const content = <View {...props} style={[styles.content, style]}>{children}</View>; return <SafeAreaView style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</SafeAreaView>; }
// On wide screens (the website, tablets) the content stays a readable centered column instead of stretching edge to edge.
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, scroll: { paddingBottom: 104 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, gap: 20 } });
