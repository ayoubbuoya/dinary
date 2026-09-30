import { openDatabaseAsync } from 'expo-sqlite';
import type { BackupFile } from '@/types/api';
import { getBackupSnapshot, migrateDbIfNeeded } from './sqlite-database';

/**
 * Reads the data the app saved on this phone before the move to MongoDB.
 * The old `dinary.db` file is only read, never changed or deleted, so it stays as a safety copy.
 */
export async function readLegacyBackup(): Promise<BackupFile> {
  const db = await openDatabaseAsync('dinary.db');
  try {
    // Brings very old databases up to the last schema. On a phone that never had data it just creates empty tables.
    await migrateDbIfNeeded(db);
    const data = await getBackupSnapshot(db);
    return { format: 'dinary-backup', version: 1, source: 'phone-sqlite', createdAt: new Date().toISOString(), data };
  } finally {
    await db.closeAsync();
  }
}

export const hasLegacyData = true;
