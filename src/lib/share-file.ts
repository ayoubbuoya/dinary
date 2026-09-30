import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Phone: writes the file to the app cache and opens the system share sheet, so the user picks where it goes. */
export async function shareFile(filename: string, content: string, mimeType: string, UTI: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }

  const file = new File(Paths.cache, filename);
  file.write(content);
  await Sharing.shareAsync(file.uri, { dialogTitle: 'Export Dinary data', mimeType, UTI });
}
