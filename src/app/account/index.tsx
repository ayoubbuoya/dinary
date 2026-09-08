import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, Check, CloudOff, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { useAuth } from '@/features/auth/auth-store';
import { useSync } from '@/features/sync/sync-store';

function formatSyncedAt(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-TN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, isConfigured, isLoading, isSigningIn, error: authError, signInWithGoogle, signOut } = useAuth();
  const { status, lastSyncedAt, pendingCount, conflictCount, error: syncError, syncNow } = useSync();

  const isSyncing = status === 'syncing';

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <View>
          <Text variant="caption">Account</Text>
          <Text variant="title">Cloud backup</Text>
        </View>
      </View>

      {!isConfigured && (
        <Card variant="outline" style={styles.row}>
          <CloudOff size={20} color={colors.textMuted} />
          <View style={styles.rowBody}>
            <Text variant="body" style={styles.rowTitle}>Cloud backup is off</Text>
            <Text variant="caption">
              This build has no Supabase project configured. Dinary keeps working normally — everything stays on this device.
            </Text>
          </View>
        </Card>
      )}

      {isConfigured && isLoading && (
        <Card variant="outline" style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </Card>
      )}

      {isConfigured && !isLoading && !user && (
        <>
          <Card variant="elevated" style={styles.stack}>
            <Text variant="subtitle">Back up your money data</Text>
            <Text variant="caption">
              Sign in to keep an encrypted copy of your accounts and transactions in the cloud, and to use Dinary on more
              than one device. Your data is private to your account.
            </Text>
            <Button loading={isSigningIn} onPress={signInWithGoogle} accessibilityLabel="Continue with Google">
              Continue with Google
            </Button>
          </Card>

          <Card variant="muted" style={styles.row}>
            <ShieldCheck size={20} color={colors.primary} />
            <View style={styles.rowBody}>
              <Text variant="body" style={styles.rowTitle}>Signing in is optional</Text>
              <Text variant="caption">
                Dinary works fully offline. Without an account your records simply stay on this device only.
              </Text>
            </View>
          </Card>
        </>
      )}

      {isConfigured && user && (
        <>
          <Card variant="elevated" style={styles.stack}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user.email ?? 'D').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.identityBody}>
                <Text variant="body" style={styles.rowTitle}>{user.email ?? 'Signed in'}</Text>
                <Text variant="caption">Signed in with Google</Text>
              </View>
            </View>
          </Card>

          <Card variant="outline" style={styles.stack}>
            <View style={styles.statusRow}>
              {isSyncing ? <ActivityIndicator color={colors.primary} /> : <Check size={20} color={colors.income} />}
              <View style={styles.rowBody}>
                <Text variant="body" style={styles.rowTitle}>
                  {isSyncing ? 'Syncing…' : `Last synced: ${formatSyncedAt(lastSyncedAt)}`}
                </Text>
                <Text variant="caption">
                  {pendingCount === 0 ? 'All changes are backed up.' : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to upload.`}
                </Text>
              </View>
            </View>

            <Button variant="secondary" loading={isSyncing} onPress={syncNow} accessibilityLabel="Sync now">
              Sync now
            </Button>
          </Card>

          {conflictCount > 0 && (
            <Card variant="outline" style={[styles.row, styles.warning]}>
              <AlertTriangle size={20} color={colors.warning} />
              <View style={styles.rowBody}>
                <Text variant="body" style={styles.rowTitle}>
                  {conflictCount} record{conflictCount === 1 ? '' : 's'} changed on another device
                </Text>
                <Text variant="caption">
                  Your version on this device was kept. The other version is saved and nothing was deleted.
                </Text>
              </View>
            </Card>
          )}

          <Button variant="ghost" onPress={signOut} accessibilityLabel="Sign out">
            Sign out
          </Button>
        </>
      )}

      {(authError ?? syncError) && (
        <Card variant="outline" style={[styles.row, styles.errorCard]}>
          <AlertTriangle size={20} color={colors.expense} />
          <View style={styles.rowBody}>
            <Text variant="caption" style={styles.errorText}>{authError ?? syncError}</Text>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  stack: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  centered: { alignItems: 'center', justifyContent: 'center', minHeight: 96 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityBody: { flex: 1, gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: colors.primaryDark },
  warning: { borderColor: colors.warning },
  errorCard: { borderColor: colors.expense },
  errorText: { color: colors.expense },
});
