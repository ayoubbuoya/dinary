import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { categoryFor } from '@/constants/categories';
import { formatMoney } from '@/lib/format-money';
import type { CustomCategory } from '@/types/category';
import type { Transaction } from '@/types/transaction';

type BackupPayload = {
  format: 'dinary-backup';
  version: 1;
  createdAt: string;
  data: unknown;
};

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function shareFile(filename: string, content: string, mimeType: string, UTI: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is available on Android and iOS.');
  }

  const file = new File(Paths.cache, filename);
  file.write(content);
  await Sharing.shareAsync(file.uri, { dialogTitle: 'Export Dinary data', mimeType, UTI });
}

export async function exportTransactionsCsv(transactions: Transaction[], customCategories: CustomCategory[] = []) {
  const rows = [
    'id,type,amount_tnd,category,title,note,occurred_at',
    ...transactions.map((transaction) => [
      transaction.id,
      transaction.type,
      formatMoney(transaction.amountMillimes).replace(' TND', ''),
      // Export the readable name (e.g. "Gym") rather than the internal ID (e.g. "custom_17...").
      categoryFor(transaction.category, customCategories).label,
      transaction.title,
      transaction.note ?? '',
      transaction.occurredAt,
    ].map((value) => escapeCsv(value)).join(',')),
  ];

  await shareFile(`dinary-transactions-${Date.now()}.csv`, rows.join('\n'), 'text/csv', 'public.comma-separated-values-text');
}

export async function createBackup(data: unknown) {
  const backup: BackupPayload = { format: 'dinary-backup', version: 1, createdAt: new Date().toISOString(), data };
  await shareFile(`dinary-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json', 'public.json');
}
