import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';
import { colors } from '@/constants/colors';
import { UnlockScreen } from '@/components/auth/UnlockScreen';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { AuthProvider, useAuth } from '@/features/auth/auth-store';
import { TransactionProvider } from '@/features/transactions/transaction-store';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="dark" /><AppShell /></AuthProvider></SafeAreaProvider>;
}

/** Financial data is loaded only after the password is accepted, and is dropped from memory when the app is locked. */
function AppShell() {
  const { status } = useAuth();
  if (status !== 'unlocked') return <UnlockScreen />;
  return <TransactionProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} /><BottomNavigation /></TransactionProvider>;
}
