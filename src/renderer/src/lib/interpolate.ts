/**
 * Linear interpolation over sorted (xArr, yArr) pairs.
 * Uses binary search — safe for large arrays (no spread/Math.min).
 */
export function interpolate(xArr: ArrayLike<number>, yArr: ArrayLike<number>, targetX: number): number {
  if (targetX <= xArr[0]) return yArr[0];
  if (targetX >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];

  let lo = 0;
  let hi = xArr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (xArr[mid] < targetX) lo = mid + 1;
    else hi = mid - 1;
  }

  const t = (targetX - xArr[lo - 1]) / (xArr[lo] - xArr[lo - 1]);
  return yArr[lo - 1] + (yArr[lo] - yArr[lo - 1]) * t;
}
