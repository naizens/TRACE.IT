/** Format seconds as  M:SS.mmm  (e.g. "1:23.456") */
export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
}

/** Format a time delta with sign  (e.g. "+0.342s" or "-0.120s") */
export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}s`;
}

/** Loop-safe max for very large arrays (avoids Math.max(...bigArray) stack overflow) */
export function arrayMax(arr: ArrayLike<number>): number {
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

/**
 * Darken a hex colour by mixing it toward black.
 * amount = 0 → unchanged, 1 → pure black.
 */
export function darken(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}

/** Loop-safe min */
export function arrayMin(arr: ArrayLike<number>): number {
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}
