export function formatTransactionDate(value: string) {
  const date = new Date(value);
  const today = new Date('2026-07-10T12:00:00+01:00');
  if (date.toDateString() === today.toDateString()) return 'Today';
  return new Intl.DateTimeFormat('en-TN', { month: 'short', day: 'numeric' }).format(date);
}
