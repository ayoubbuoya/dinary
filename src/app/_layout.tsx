import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';
import { colors } from '@/constants/colors';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { TransactionProvider } from '@/features/transactions/transaction-store';
import { AuthProvider } from '@/features/auth/auth-store';
import { SyncProvider } from '@/features/sync/sync-store';
import { migrateDbIfNeeded } from '@/features/transactions/database';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="dinary.db" onInit={migrateDbIfNeeded}>
        <AuthProvider>
          <TransactionProvider>
            {/* Sync sits inside the stores it reads from and refreshes. */}
            <SyncProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
              <BottomNavigation />
            </SyncProvider>
          </TransactionProvider>
        </AuthProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
