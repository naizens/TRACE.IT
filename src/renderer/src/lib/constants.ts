import type { LapColor } from '../types/session';

// ── Lap comparison colour palette ────────────────────────────────────────────
export const LAP_COLORS: Record<LapColor, string> = {
  ref:  '#ffffff',
  blue: '#38bdf8',
  pink: '#e879f9',
  lime: '#a3e635',
};

/** Rendering priority: ref is always first (the "baseline" lap) */
export const COLOR_ORDER: LapColor[] = ['ref', 'blue', 'pink', 'lime'];

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
  { id: 'delta', label: 'Time Delta  s',   dataKey: null,                 multiplier: 1,   fixedScale: false, flex: 1.2, stepped: false },
];

