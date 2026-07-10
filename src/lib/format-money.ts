export function formatMoney(millimes: number, options: { sign?: boolean } = {}) {
  const absolute = Math.abs(millimes);
  const formatted = new Intl.NumberFormat('en-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(absolute / 1000);
  const sign = options.sign && millimes !== 0 ? (millimes > 0 ? '+' : '-') : millimes < 0 ? '-' : '';
  return `${sign}${formatted} TND`;
}
