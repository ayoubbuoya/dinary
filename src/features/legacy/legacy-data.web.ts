import type { BackupFile } from '@/types/api';

/** The old SQLite data only exists inside the phone app. On the website, import a backup file instead. */
export async function readLegacyBackup(): Promise<BackupFile> {
  throw new Error('Old phone data can only be read from the Dinary phone app.');
}

export const hasLegacyData = false;
