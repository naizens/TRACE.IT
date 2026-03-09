import type { ParsedSession, LapSelections } from '../types/session';
import { getLapColor, COLOR_ORDER } from './constants';
import { interpolate } from './interpolate';
import { arrayMax } from './formatters';

/**
 * Dead-reckoning XY for a lap (same formula as the TrackMap canvas).
 * Returns Float32Arrays in metres from the lap start position.
 */
function deadReckon(
  spd:  ArrayLike<number>,
  yaw:  ArrayLike<number>,
  time: ArrayLike<number>,
): { x: Float32Array; y: Float32Array } {
  const n = spd.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const dt = time[i] - time[i - 1];
    x[i] = x[i - 1] + spd[i] * Math.cos(yaw[i]) * dt;
    y[i] = y[i - 1] + spd[i] * Math.sin(yaw[i]) * dt;
  }
  return { x, y };
}

/**
 * Lateral offset of a comparison lap vs the reference lap, in metres.
 * At each track distance we project the XY difference onto the track
 * normal (⊥ to the reference heading): left = +, right = −.
 */
function computeLateralOffset(
  lapSpd:  ArrayLike<number>, lapYaw: ArrayLike<number>, lapTime: ArrayLike<number>, lapDist: ArrayLike<number>,
  refSpd:  ArrayLike<number>, refYaw: ArrayLike<number>, refTime: ArrayLike<number>, refDist: ArrayLike<number>,
  axis: number[],
): { x: number; y: number }[] {
  const lap = deadReckon(lapSpd, lapYaw, lapTime);
  const ref = deadReckon(refSpd, refYaw, refTime);
  return axis.map((d) => {
    const lx   = interpolate(lapDist, lap.x, d);
    const ly   = interpolate(lapDist, lap.y, d);
    const rx   = interpolate(refDist, ref.x, d);
    const ry   = interpolate(refDist, ref.y, d);
    const ryaw = interpolate(refDist, refYaw, d);
    // left normal of ref heading: (−sin θ, cos θ)
    const lateral = (lx - rx) * (-Math.sin(ryaw)) + (ly - ry) * Math.cos(ryaw);
    return { x: Math.round(d), y: lateral };
  });
}

export interface LapDataset {
  borderColor: string;
  borderWidth: number;
  pointRadius: number;
  pointHoverRadius: number;
  tension: number;
  label: string;
  stepped?: boolean | 'before' | 'middle' | 'after';
  borderDash?: number[];
  normalized?: boolean;
  data: { x: number; y: number }[];
}

export interface ChartDatasets {
  thr:   LapDataset[];
  brk:   LapDataset[];
  gear:  LapDataset[];
  rpm:   LapDataset[];
  spd:   LapDataset[];
  str:   LapDataset[];
  delta: LapDataset[];
  line:  LapDataset[];
}

export interface BuiltChartData {
  datasets: ChartDatasets;
  maxDist: number;
}

/**
 * Builds Chart.js dataset arrays for all 6 channels by:
 * 1. Slicing raw data for each selected lap (across any loaded session)
 * 2. Resampling to a fixed number of points via linear interpolation
 * 3. Computing the time delta relative to the first ("ref") lap
 *
 * Selection keys are "sessionIdx:lapIdx" strings.
 */
export function buildChartData(
  sessions: ParsedSession[],
  selections: LapSelections,
): BuiltChartData {
  const multiSession = sessions.length > 1;

  // Collect unique session indices referenced by the current selections
  const usedSessionIndices = new Set(
    Object.keys(selections).map((k) => parseInt(k.split(':')[0])),
  );

  // x-axis upper bound: max LapDist across all referenced sessions
  let maxDist = 0;
  for (const si of usedSessionIndices) {
    const lapDistArr = sessions[si]?.data['LapDist'] ?? new Float32Array();
    if (lapDistArr.length > 0) maxDist = Math.max(maxDist, arrayMax(lapDistArr));
  }

  // 1 point per metre of track
  const resolution = Math.ceil(maxDist);
  const axis = Array.from(
    { length: resolution },
    (_, i) => (maxDist / resolution) * i,
  );

  const ds: ChartDatasets = { thr: [], brk: [], gear: [], rpm: [], spd: [], str: [], delta: [], line: [] };

  // Build per-lap data slices, sorted by colour rendering order
  const entries = Object.entries(selections) as [string, (typeof COLOR_ORDER)[number]][];
  const sorted = entries
    .map(([key, color]) => {
      const colon     = key.indexOf(':');
      const sessionIdx = parseInt(key.substring(0, colon));
      const lapIdx    = parseInt(key.substring(colon + 1));

      const session = sessions[sessionIdx];
      if (!session) return null;
      const lap = session.laps[lapIdx];
      if (!lap) return null;

      const s = lap.start_idx;
      const e = lap.end_idx + 1;
      const d = session.data;
      const sessionTime = d['SessionTime'] ?? new Float32Array();

      return {
        color,
        sessionIdx,
        lapNum: lap.lap,
        dist:     (d['LapDist']           ?? new Float32Array()).slice(s, e),
        time:     sessionTime.slice(s, e).map((v) => v - sessionTime[s]),
        thr:      (d['Throttle']           ?? new Float32Array()).slice(s, e),
        brk:      (d['Brake']              ?? new Float32Array()).slice(s, e),
        spd:      (d['Speed']              ?? new Float32Array()).slice(s, e),
        str:      (d['SteeringWheelAngle'] ?? new Float32Array()).slice(s, e),
        gear: (d['Gear'] ?? new Float32Array()).slice(s, e),
        rpm:  (d['RPM']  ?? new Float32Array()).slice(s, e),
        yaw:  (d['Yaw']  ?? new Float32Array()).slice(s, e),
      };
    })
    .filter(Boolean)
    .sort((a, b) => COLOR_ORDER.indexOf(a!.color) - COLOR_ORDER.indexOf(b!.color));

  const ref = sorted[0];

  for (const lap of sorted) {
    if (!lap) continue;

    // Include session number in label when multiple sessions are loaded
    const label = multiSession
      ? `S${lap.sessionIdx + 1}·L${lap.lapNum}`
      : `L${lap.lapNum}`;

    const style: Pick<LapDataset, 'borderColor' | 'borderWidth' | 'pointRadius' | 'pointHoverRadius' | 'tension' | 'label'> = {
      borderColor: getLapColor(lap.color),
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4,
      label,
    };

    const resample = (arr: ArrayLike<number>, mult = 1) =>
      axis.map((x) => ({ x: Math.round(x), y: interpolate(lap.dist, arr, x) * mult }));

    ds.thr.push({ ...style, data: resample(lap.thr, 100) });
    ds.brk.push({ ...style, data: resample(lap.brk, 100) });
    ds.spd.push({ ...style, data: resample(lap.spd, 3.6) });
    ds.str.push({ ...style, data: resample(lap.str) });
    ds.gear.push({ ...style, stepped: 'before', tension: 0, data: resample(lap.gear) });
    ds.rpm.push({ ...style, data: resample(lap.rpm) });
    // Lateral driving line offset and time delta — only for comparison laps
    if (ref && lap !== ref) {
      ds.line.push({
        ...style,
        data: computeLateralOffset(
          lap.spd, lap.yaw, lap.time, lap.dist,
          ref.spd, ref.yaw, ref.time, ref.dist,
          axis,
        ),
      });
      ds.delta.push({
        ...style,
        data: axis.map((x) => ({
          x: Math.round(x),
          y: interpolate(lap.dist, lap.time, x) - interpolate(ref.dist, ref.time, x),
        })),
      });
    }
  }

  return { datasets: ds, maxDist };
}
