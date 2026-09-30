/** Opens the browser's file chooser and returns the parsed JSON, or null if the user cancels. */
export function pickBackupFile(): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(JSON.parse(await file.text()));
      } catch {
        reject(new Error('This file is not a valid JSON backup.'));
      }
    });
    input.click();
  });
}

export const canPickBackupFile = true;
