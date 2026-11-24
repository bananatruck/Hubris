/**
 * Orders ISO timestamps at full precision. Date.parse stops at milliseconds, so digits after them
 * break ties; equal instants compare as 0.
 */
export function compareTimestamps(left: string, right: string) {
  const leftMilliseconds = Date.parse(left);
  const rightMilliseconds = Date.parse(right);
  if (leftMilliseconds !== rightMilliseconds) return leftMilliseconds > rightMilliseconds ? 1 : -1;

  const fractionalDigits = (value: string) =>
    (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').slice(3);
  const leftExtra = fractionalDigits(left);
  const rightExtra = fractionalDigits(right);
  const width = Math.max(leftExtra.length, rightExtra.length);
  const normalizedLeft = leftExtra.padEnd(width, '0');
  const normalizedRight = rightExtra.padEnd(width, '0');
  return normalizedLeft === normalizedRight ? 0 : normalizedLeft > normalizedRight ? 1 : -1;
}
