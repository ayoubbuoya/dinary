import { categoryFor } from '@/constants/categories';
import { formatMoney } from '@/lib/format-money';
import { shareFile } from '@/lib/share-file';
import type { BackupFile } from '@/types/api';
import type { CustomCategory } from '@/types/category';
import type { Transaction } from '@/types/transaction';

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
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

/** Saves a backup as a JSON file. The name says which kind it is: `phone` (old SQLite) or `cloud` (MongoDB). */
export async function saveBackupFile(backup: BackupFile, kind: 'phone' | 'cloud') {
  await shareFile(`dinary-${kind}-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json', 'public.json');
}
