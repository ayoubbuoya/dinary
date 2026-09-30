import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Cloud, FileUp, LockKeyhole, Smartphone } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { useAuth } from '@/features/auth/auth-store';
import { hasLegacyData, readLegacyBackup } from '@/features/legacy/legacy-data';
import { useTransactions } from '@/features/transactions/transaction-store';
import { showAlert } from '@/lib/alert';
import { canPickBackupFile, pickBackupFile } from '@/lib/pick-backup-file';
import { saveBackupFile } from '@/lib/transaction-export';
import type { BackupFile, ImportSummary } from '@/types/api';

type Busy = 'cloud' | 'old-file' | 'old-import' | 'file-import' | null;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function countRecords(backup: BackupFile) {
  const count = (key: string) => (Array.isArray(backup.data[key]) ? backup.data[key].length : 0);
  return { transactions: count('transactions'), accounts: count('accounts'), other: count('recurringRules') + count('categoryBudgets') + count('customCategories') };
}

export default function BackupScreen() {
  const { downloadCloudBackup, importBackup } = useTransactions();
  const { lock } = useAuth();
  const [busy, setBusy] = useState<Busy>(null);
  const [lastImport, setLastImport] = useState<ImportSummary>();

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, failureTitle: string) => {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      showAlert(failureTitle, errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (backup: BackupFile) => {
    const summary = await importBackup(backup);
    setLastImport(summary);
    showAlert('Import finished', `Added ${summary.added}, updated ${summary.updated}, already up to date ${summary.skipped}.`);
  };

  const copyOldDataToCloud = async () => {
    let backup: BackupFile;
    try {
      backup = await readLegacyBackup();
    } catch (error) {
      showAlert('Could not read old data', errorText(error));
      return;
    }

    const found = countRecords(backup);
    if (found.transactions + found.accounts + found.other === 0) {
      showAlert('Nothing to copy', 'No old data was found on this phone.');
      return;
    }
    showAlert(
      'Copy old phone data to the cloud?',
      `Found ${found.transactions} transactions, ${found.accounts} accounts and ${found.other} other records. ` +
        'Records already in the cloud are only replaced by a newer version, so you can safely run this again. The data on this phone is not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy to cloud', onPress: () => void run('old-import', () => doImport(backup), 'Copy failed') },
      ],
    );
  };

  const importFromFile = () =>
    run('file-import', async () => {
      const file = await pickBackupFile();
      if (file) await doImport(file as BackupFile);
    }, 'Import failed');

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Backup & data</Text>
        <Text variant="caption">Your data is stored in your private MongoDB Atlas database.</Text>
      </View>

      <Section Icon={Cloud} title="New backup (cloud)" description="Save everything stored in the cloud, including deleted transactions, as one JSON file.">
        <Button loading={busy === 'cloud'} disabled={busy !== null} onPress={() => void run('cloud', downloadCloudBackup, 'Backup failed')}>
          Download cloud backup
        </Button>
      </Section>

      {hasLegacyData && (
        <Section
          Icon={Smartphone}
          title="Old backup (phone SQLite)"
          description="Older Dinary versions saved your data only on this phone. Copy it to the cloud once, or keep a file copy of it."
        >
          <Button loading={busy === 'old-import'} disabled={busy !== null} onPress={() => void copyOldDataToCloud()}>
            Copy old phone data to cloud
          </Button>
          <Button
            variant="secondary"
            loading={busy === 'old-file'}
            disabled={busy !== null}
            onPress={() => void run('old-file', async () => saveBackupFile(await readLegacyBackup(), 'phone'), 'Backup failed')}
          >
            Save old backup file
          </Button>
        </Section>
      )}

      {canPickBackupFile && (
        <Section
          Icon={FileUp}
          title="Import a backup file"
          description="Upload a Dinary backup file: an old phone backup or a cloud backup. Nothing is duplicated, and newer cloud records are never overwritten by older ones."
        >
          <Button variant="secondary" loading={busy === 'file-import'} disabled={busy !== null} onPress={() => void importFromFile()}>
            Choose backup file
          </Button>
        </Section>
      )}

      {lastImport && (
        <Card variant="muted" style={styles.result} accessibilityLiveRegion="polite">
          <Text variant="label">LAST IMPORT</Text>
          <Text>
            Added {lastImport.added} · Updated {lastImport.updated} · Already up to date {lastImport.skipped}
          </Text>
          <Text variant="caption">
            Transactions: +{lastImport.byCollection.transactions.added}, accounts updated: {lastImport.byCollection.accounts.updated}
          </Text>
        </Card>
      )}

      <Section
        Icon={LockKeyhole}
        title="Security"
        description={Platform.OS === 'web'
          ? 'Sign this browser out. You will need your password to open Dinary again.'
          : 'Forget the saved password on this phone. You will need it again to open Dinary.'}
      >
        <Button variant="ghost" disabled={busy !== null} onPress={() => void lock()}>
          {Platform.OS === 'web' ? 'Sign out of this browser' : 'Lock Dinary on this phone'}
        </Button>
      </Section>
    </Screen>
  );
}

function Section({ Icon, title, description, children }: { Icon: typeof Cloud; title: string; description: string; children: ReactNode }) {
  return (
    <Card variant="outline" style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.primary} />
        </View>
        <View style={styles.sectionCopy}>
          <Text variant="subtitle">{title}</Text>
          <Text variant="caption">{description}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  section: { gap: 14 },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sectionCopy: { flex: 1, gap: 4 },
  icon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  result: { gap: 6 },
});
