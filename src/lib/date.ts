export function getLocalMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-TN', { month: 'long', year: 'numeric' }).format(date);
}

export function formatToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-TN', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}
