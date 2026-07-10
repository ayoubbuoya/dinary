/**
 * Parses a user-entered TND value into millimes without using floating-point
 * arithmetic. Both a period and a comma are accepted as the decimal separator.
 */
export function parseTndToMillimes(value: string): number | null {
  const input = value.trim().replace(/\s/g, '');
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(input);

  if (!match) return null;

  const dinars = Number(match[1]);
  const fractionalMillimes = Number((match[2] ?? '').padEnd(3, '0'));
  const millimes = dinars * 1000 + fractionalMillimes;

  return Number.isSafeInteger(millimes) && millimes > 0 ? millimes : null;
}
