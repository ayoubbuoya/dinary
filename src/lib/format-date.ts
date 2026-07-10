export function formatTransactionDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return new Intl.DateTimeFormat('en-TN', { month: 'short', day: 'numeric' }).format(date);
}
