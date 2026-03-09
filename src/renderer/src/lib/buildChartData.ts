import type { ParsedSession, LapSelections } from '../types/session';
import { getLapColor, COLOR_ORDER } from './constants';
import { interpolate } from './interpolate';
import { arrayMax } from './formatters';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_R    = 6_371_000; // metres

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
  thr:    LapDataset[];
  brk:    LapDataset[];
  gear:   LapDataset[];
  rpm:    LapDataset[];
  spd:    LapDataset[];
  str:    LapDataset[];
  delta:  LapDataset[];
  latDev: LapDataset[];
}

export interface BuiltChartData {
  datasets: ChartDatasets;
  maxDist: number;
}

/**
 * Builds Chart.js dataset arrays for all channels by:
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

  const usedSessionIndices = new Set(
    Object.keys(selections).map((k) => parseInt(k.split(':')[0])),
  );

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

  const ds: ChartDatasets = { thr: [], brk: [], gear: [], rpm: [], spd: [], str: [], delta: [], latDev: [] };

  const entries = Object.entries(selections) as [string, (typeof COLOR_ORDER)[number]][];
  const sorted = entries
    .map(([key, color]) => {
      const colon      = key.indexOf(':');
      const sessionIdx = parseInt(key.substring(0, colon));
      const lapIdx     = parseInt(key.substring(colon + 1));

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
        dist: (d['LapDist']           ?? new Float32Array()).slice(s, e),
        time: sessionTime.slice(s, e).map((v) => v - sessionTime[s]),
        thr:  (d['Throttle']           ?? new Float32Array()).slice(s, e),
        brk:  (d['Brake']              ?? new Float32Array()).slice(s, e),
        spd:  (d['Speed']              ?? new Float32Array()).slice(s, e),
        str:  (d['SteeringWheelAngle'] ?? new Float32Array()).slice(s, e),
        gear: (d['Gear'] ?? new Float32Array()).slice(s, e),
        rpm:  (d['RPM']  ?? new Float32Array()).slice(s, e),
        lat:  (d['Lat']  ?? new Float64Array()).slice(s, e),
        lon:  (d['Lon']  ?? new Float64Array()).slice(s, e),
      };
    })
    .filter(Boolean)
    .sort((a, b) => COLOR_ORDER.indexOf(a!.color) - COLOR_ORDER.indexOf(b!.color));

  const ref = sorted[0];

  for (const lap of sorted) {
    if (!lap) continue;

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

    if (ref && lap !== ref) {
      // Reference lap zero-line for delta (added once)
      if (ds.delta.length === 0) {
        const refLabel = multiSession ? `S${ref.sessionIdx + 1}·L${ref.lapNum}` : `L${ref.lapNum}`;
        ds.delta.push({
          borderColor: getLapColor(ref.color),
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          label: refLabel,
          data: axis.map((x) => ({ x: Math.round(x), y: 0 })),
        });
      }

      ds.delta.push({
        ...style,
        data: axis.map((x) => ({
          x: Math.round(x),
          y: interpolate(lap.dist, lap.time, x) - interpolate(ref.dist, ref.time, x),
        })),
      });

      // Lateral deviation: signed perpendicular distance in metres between
      // this lap's GPS position and the ref lap's GPS position at each LapDist.
      // Positive = comp lap is left of ref lap's heading.
      // Reference lap zero-line (added once, before the first comparison dataset)
      if (ds.latDev.length === 0) {
        const refLabel = multiSession ? `S${ref.sessionIdx + 1}·L${ref.lapNum}` : `L${ref.lapNum}`;
        ds.latDev.push({
          borderColor: getLapColor(ref.color),
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          label: refLabel,
          data: axis.map((x) => ({ x: Math.round(x), y: 0 })),
        });
      }

      if (ref.lat.length > 1 && lap.lat.length > 1) {
        const lat0Rad = ref.lat[0] * DEG_TO_RAD;
        const lon0    = ref.lon[0];
        const cosLat0 = Math.cos(lat0Rad);
        const toX = (lo: number) => (lo - lon0)              * cosLat0 * EARTH_R * DEG_TO_RAD;
        const toY = (la: number) => (la * DEG_TO_RAD - lat0Rad)        * EARTH_R;

        // Pre-convert ref and comp GPS to metres
        const rn = ref.lat.length;
        const refXM = new Float64Array(rn), refYM = new Float64Array(rn);
        for (let i = 0; i < rn; i++) { refXM[i] = toX(ref.lon[i]); refYM[i] = toY(ref.lat[i]); }

        const cn = lap.lat.length;
        const cmpXM = new Float64Array(cn), cmpYM = new Float64Array(cn);
        for (let i = 0; i < cn; i++) { cmpXM[i] = toX(lap.lon[i]); cmpYM[i] = toY(lap.lat[i]); }

        const EPS = 5; // metres for finite-difference tangent
        ds.latDev.push({
          ...style,
          data: axis.map((x) => {
            const rx  = interpolate(ref.dist, refXM, x);
            const ry  = interpolate(ref.dist, refYM, x);
            const rx2 = interpolate(ref.dist, refXM, Math.min(x + EPS, maxDist));
            const ry2 = interpolate(ref.dist, refYM, Math.min(x + EPS, maxDist));
            const tx  = rx2 - rx, ty = ry2 - ry;
            const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
            const cx  = interpolate(lap.dist, cmpXM, x);
            const cy  = interpolate(lap.dist, cmpYM, x);
            // cross(tangent, delta): positive = comp is to the left of ref
            return { x: Math.round(x), y: Math.round((tx * (cy - ry) - ty * (cx - rx)) / tlen * 100) / 100 };
          }),
        });
      }
    }
  }

  return { datasets: ds, maxDist };
}
