import type { LapInfo, ParsedSession } from '../types/session';

export interface PaceCluster { lo: number; hi: number }

/**
 * Finds the largest group of lap times that are all within `tolerance` of
 * their neighbour (chained, not just vs. the group average) — i.e. the
 * dominant race pace. More robust than a median-based threshold: sessions
 * combined from multiple IBT segments can have *more* broken laps (resets/
 * teleports at the seams) than genuine ones, which drags a median down far
 * enough that garbage laps pass a "median * 0.5" cutoff.
 */
export function findPaceCluster(times: number[], tolerance = 0.08): PaceCluster | null {
  const sorted = times.filter((t) => t > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  let bestStart = 0, bestLen = 1, start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] > sorted[i - 1] * (1 + tolerance)) {
      const len = i - start;
      if (len > bestLen) { bestLen = len; bestStart = start; }
      start = i;
    }
  }
  return { lo: sorted[bestStart], hi: sorted[bestStart + bestLen - 1] };
}

/** Is `t` within the pace cluster (plus a little slack for natural lap-time variance)? */
export function isValidLapTime(t: number, cluster: PaceCluster | null, tolerance = 0.08): boolean {
  if (!cluster || !(t > 0)) return false;
  return t >= cluster.lo * (1 - tolerance) && t <= cluster.hi * (1 + tolerance);
}

/** Convenience: valid (non-pit, on-pace) laps for a session, ready for reuse across views. */
export function getValidLaps(session: ParsedSession): LapInfo[] {
  const { laps, data } = session;
  const onPit   = data['OnPitRoad'];
  const cluster = findPaceCluster(laps.map((l) => l.lap_time_s));

  return laps.filter((lap) => {
    if (!isValidLapTime(lap.lap_time_s, cluster)) return false;
    if (onPit) {
      for (let i = lap.start_idx; i <= lap.end_idx; i++) {
        if (onPit[i] > 0.5) return false;
      }
    }
    return true;
  });
}

export interface SessionStats {
  avgLapTimeS:    number | null;
  avgFuelPerLapL: number | null;
  validLapCount:  number;
}

/** Average lap time and average fuel-per-lap over valid (on-pace, non-pit) laps. */
export function computeSessionStats(session: ParsedSession): SessionStats {
  const validLaps = getValidLaps(session);
  const fuel      = session.data['FuelLevel'];

  if (validLaps.length === 0) {
    return { avgLapTimeS: null, avgFuelPerLapL: null, validLapCount: 0 };
  }

  const avgLapTimeS = validLaps.reduce((sum, l) => sum + l.lap_time_s, 0) / validLaps.length;

  let avgFuelPerLapL: number | null = null;
  if (fuel) {
    const usages = validLaps
      .map((lap) => fuel[lap.start_idx] - fuel[lap.end_idx])
      .filter((v) => v > 0); // guard against refuel / sensor glitches
    if (usages.length > 0) {
      avgFuelPerLapL = usages.reduce((a, b) => a + b, 0) / usages.length;
    }
  }

  return { avgLapTimeS, avgFuelPerLapL, validLapCount: validLaps.length };
}
