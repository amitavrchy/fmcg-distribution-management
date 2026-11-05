export function safeMinor(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_000_000_000) throw new Error('Invalid monetary amount');
  return value;
}
export function proportional(total: number, part: number, whole: number) { return whole ? Math.round(total * part / whole) : 0; }
