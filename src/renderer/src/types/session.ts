// Mirrors the ParsedSession shape returned by the Electron main-process parser.
// Keeping this in the renderer avoids a cross-process import.

export interface LapInfo {
  lap: number;
  start_idx: number;
  end_idx: number;
  lap_time_s: number;
  duration_s: number;
}

export interface SessionMeta {
  source_file: string;
  tick_rate_hz: number;
  sample_count: number;
  humidity_pct: number | null;
  sectors: number[];
  track_id: number | null;
}

export interface ParsedSession {
  meta: SessionMeta;
  laps: LapInfo[];
  /** Telemetry channel arrays, keyed by iRacing variable name.
   *  GPS/heading channels (Lat, Lon, YawNorth) use Float64Array; all others Float32Array. */
  data: Record<string, Float32Array | Float64Array>;
  /** CarSetup YAML section as a nested object */
  setup: Record<string, unknown>;
  /** Filename without extension, used as display label */
  _filename: string;
}

// ─── Lap selection types ────────────────────────────────────────────────────

export type LapColor = 'ref' | 'blue' | 'pink' | 'lime';

/** Map of "sessionIdx:lapIdx" → assigned colour slot */
export type LapSelections = Record<string, LapColor>;
