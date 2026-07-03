import type { LapColor } from '../types/session';

// ── Lap comparison colour palette ────────────────────────────────────────────
// 'ref' and 'blue' are internal slot identifiers (kept for backward-compat with
// existing selection keys/priority order) — displayed as green/red so a 2-lap
// comparison (the common case) reads as green = this lap, red = other lap.
export const LAP_COLORS: Record<LapColor, string> = {
  ref:  '#4ade80', // green-400
  blue: '#f87171', // red-400
  pink: '#e879f9',
  lime: '#a3e635',
};

/** Human-readable label for the colour swatch UI (LapList tooltips etc.) */
export const LAP_COLOR_LABELS: Record<LapColor, string> = {
  ref:  'Green',
  blue: 'Red',
  pink: 'Pink',
  lime: 'Lime',
};

/**
 * Selectable slots, in priority order (ref is always the "baseline" lap).
 * Capped at 2 (green/red) — drives both the swatch UI in LapList and the
 * max-selection capacity check in useStore's toggleLapColor.
 */
export const COLOR_ORDER: LapColor[] = ['ref', 'blue'];

/** Returns the display color for a lap */
export function getLapColor(color: LapColor): string {
  return LAP_COLORS[color];
}

// ── Driving-tab traces: fixed per-channel colors when only a single lap is
// selected (channels are visually distinguished by color instead of by lap).
// Independent of LAP_COLORS — that palette is for lap identity (green/red),
// this one is for channel identity, so they must not collide semantically.
export const TRACE_CHANNEL_COLORS: Record<'spd' | 'thr' | 'brk' | 'gear' | 'rpm' | 'str', string> = {
  spd:  '#38bdf8', // sky-400 ("our blue")
  thr:  '#4ade80', // green-400
  brk:  '#f87171', // red-400
  gear: '#facc15', // yellow-400
  rpm:  '#fb923c', // orange-400
  str:  '#38bdf8', // sky-400
};

// ── Telemetry chart channel definitions ──────────────────────────────────────
export interface ChartConfig {
  id: string;
  label: string;
  /** iRacing data key — null for derived channels (e.g. delta) */
  dataKey: string | null;
  /** Multiply raw value before display (e.g. Speed m/s → km/h = ×3.6) */
  multiplier: number;
  /** Clamp Y axis to [0, 105] — used for throttle/brake % charts */
  fixedScale: boolean;
  /** CSS flex-grow value controlling chart height proportions */
  flex: number;
  /** Use stepped line rendering (gears don't interpolate) */
  stepped: boolean;
}

export const CHART_CONFIGS: ChartConfig[] = [
  { id: 'thr',   label: 'Throttle',        dataKey: 'Throttle',           multiplier: 100, fixedScale: true,  flex: 1.2, stepped: false },
  { id: 'brk',   label: 'Brake',           dataKey: 'Brake',              multiplier: 100, fixedScale: true,  flex: 1.2, stepped: false },
  { id: 'gear',  label: 'Gear',            dataKey: 'Gear',               multiplier: 1,   fixedScale: false, flex: 0.8, stepped: true  },
  { id: 'rpm',   label: 'RPM',             dataKey: 'RPM',                multiplier: 1,   fixedScale: false, flex: 1.5, stepped: false },
  { id: 'spd',   label: 'Speed  km/h',     dataKey: 'Speed',              multiplier: 3.6, fixedScale: false, flex: 2.8, stepped: false },
  { id: 'str',   label: 'Steering  deg',   dataKey: 'SteeringWheelAngle', multiplier: 1,   fixedScale: false, flex: 2.8, stepped: false },
  { id: 'delta',  label: 'Time Delta  s',   dataKey: null, multiplier: 1, fixedScale: false, flex: 1.2, stepped: false },
  { id: 'latDev', label: 'Driving Line Diff', dataKey: null, multiplier: 1, fixedScale: false, flex: 1.5, stepped: false },
];

