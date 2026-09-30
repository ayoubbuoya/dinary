/** Picking a backup file is only offered on the website for now. On the phone, old data is read straight from SQLite. */
export async function pickBackupFile(): Promise<unknown | null> {
  throw new Error('Importing a backup file is available on the Dinary website.');
}

export const canPickBackupFile = false;
