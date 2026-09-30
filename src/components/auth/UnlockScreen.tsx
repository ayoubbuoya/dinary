import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LockKeyhole } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { useAuth } from '@/features/auth/auth-store';

const isWeb = Platform.OS === 'web';

/** Shown instead of the app until the owner's password is accepted (or while the saved session is checked). */
export function UnlockScreen() {
  const { status, errorMessage, unlock, retry } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      await unlock(password);
      setPassword('');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.icon}>
            <LockKeyhole size={26} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text variant="title">Dinary</Text>
            <Text variant="caption" style={styles.centerText}>
              {isWeb
                ? 'Your private wallet. Enter your password to continue.'
                : 'Enter your Dinary password once. This phone will remember it.'}
            </Text>
          </View>

          {status === 'checking' ? (
            <View style={styles.status} accessibilityLabel="Checking your session">
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption">Checking your session…</Text>
            </View>
          ) : status === 'unreachable' ? (
            <View style={styles.form}>
              <Text style={styles.errorText} accessibilityRole="alert">
                {errorMessage ?? 'Could not reach the Dinary server.'}
              </Text>
              <Button onPress={retry}>Try again</Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="PASSWORD"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError(undefined);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                error={error}
                autoFocus
              />
              <Button loading={isSubmitting} onPress={() => void submit()}>Unlock</Button>
            </View>
          )}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, gap: 20, padding: 24 },
  icon: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  copy: { alignItems: 'center', gap: 6 },
  centerText: { textAlign: 'center' },
  status: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  form: { gap: 14 },
  errorText: { color: colors.expense, textAlign: 'center' },
});
