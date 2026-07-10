import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';
import { colors } from '@/constants/colors';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { TransactionProvider } from '@/features/transactions/transaction-store';

export default function RootLayout() {
  return <SafeAreaProvider><TransactionProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} /><BottomNavigation /></TransactionProvider></SafeAreaProvider>;
}
