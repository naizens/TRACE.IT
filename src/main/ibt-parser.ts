/**
 * iRacing IBT binary file parser — runs in the Electron main process (Node.js).
 *
 * Verified header offsets:
 *   8   → tickRate            (int32)
 *  16   → sessionInfoLen      (int32)
 *  20   → sessionInfoOffset   (int32)
 *  24   → numVars             (int32)
 *  28   → varHeaderOffset     (int32)
 *  36   → bufLen              (int32)
 *  52   → varBuf[0].bufOffset (int32)
 * 140   → sessionRecordCount / numSamples (int32)
 *
 * Variable descriptor layout: 144 bytes each
 *   +0   type   (int32) — 0=char, 1=bool, 2=int, 3=bitfield, 4=float, 5=double
 *   +4   offset (int32)
 *   +8   count  (int32)
 *  +16   name   (char[32], null-terminated)
 */

import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LapInfo {
  lap: number;
  start_idx: number;
  end_idx: number;
  lap_time_s: number;
  duration_s: number;
}

export interface ParsedSession {
  meta: {
    source_file: string;
    tick_rate_hz: number;
    sample_count: number;
    humidity_pct: number | null;
    sectors: number[];
    track_id: number | null;
  };
  laps: LapInfo[];
  data: Record<string, Float32Array | Float64Array>;
  setup: Record<string, unknown>;
  _filename: string;
}

// ─── Data type readers ───────────────────────────────────────────────────────

type Reader = (buf: Buffer, offset: number) => number;

const DTYPE: Record<number, Reader> = {
  0: (buf, off) => buf.readUInt8(off),        // char
  1: (buf, off) => buf.readUInt8(off),        // bool
  2: (buf, off) => buf.readInt32LE(off),      // int
  3: (buf, off) => buf.readUInt32LE(off),     // bitfield
  4: (buf, off) => buf.readFloatLE(off),      // float
  5: (buf, off) => buf.readDoubleLE(off),     // double
};

// ─── Channels to extract ─────────────────────────────────────────────────────

const NEEDED_VARS = new Set([
  // Core telemetry
  'SessionTime', 'Lap', 'LapDist', 'LapDistPct', 'Throttle', 'Brake', 'BrakeABScutPct',
  'SteeringWheelAngle', 'Speed', 'LapLastLapTime', 'Gear', 'RPM',
  // Live setup data
  'FuelLevel', 'DcBrakeBias',
  'LFpressure', 'RFpressure', 'LRpressure', 'RRpressure',
  'LFtempL', 'LFtempM', 'LFtempR',
  'RFtempL', 'RFtempM', 'RFtempR',
  'LRtempL', 'LRtempM', 'LRtempR',
  'RRtempL', 'RRtempM', 'RRtempR',
  'LFrideHeight', 'RFrideHeight', 'LRrideHeight', 'RRrideHeight',
  // Track-map GPS position + world-frame velocity transform
  'Lat', 'Lon',
  'Yaw', 'YawNorth', 'VelocityX', 'VelocityY',
  // Shock / damper velocities (m/s) — used for damper histograms
  'LFshockVel', 'RFshockVel', 'LRshockVel', 'RRshockVel',
  // Shock deflections (m) — used for shock deflection view
  'LFshockDefl', 'RFshockDefl', 'LRshockDefl', 'RRshockDefl',
  // Weather
  'AirTemp', 'TrackTemp',
  // Driving line lateral offset uses Speed + Yaw (already extracted above)
]);

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseIbt(buffer: Buffer, filename: string): ParsedSession {
  // Header fields
  const tickRate          = buffer.readInt32LE(8);
  const sessionInfoLen    = buffer.readInt32LE(16);
  const sessionInfoOffset = buffer.readInt32LE(20);
  const numVars           = buffer.readInt32LE(24);
  const varHeaderOffset   = buffer.readInt32LE(28);
  const bufLen            = buffer.readInt32LE(36);
  const bufOffset         = buffer.readInt32LE(52);
  const numSamples        = buffer.readInt32LE(140);

  // ── Session Info YAML → CarSetup + WeatherInfo ───────────────────────────
  // We extract individual blocks before full yaml.load to avoid it throwing
  // on unquoted colons in track names, multi-doc separators, etc.
  let carSetup: Record<string, unknown> = {};
  let humidityPct: number | null = null;
  let sectors: number[] = [];
  let trackId: number | null = null;
  try {
    const raw = buffer.subarray(sessionInfoOffset, sessionInfoOffset + sessionInfoLen);
    // Stop at first null byte; decode as latin-1 to tolerate non-UTF8 bytes
    let str = raw.toString('latin1').split('\x00')[0];
    // Strip any garbage prefix bytes before the first printable letter
    const match = str.match(/[a-zA-Z-]/);
    if (match) str = str.slice(match.index);

    // Extract just the CarSetup block (stop at next top-level key or end)
    const csMatch = str.match(/(?:^|\n)(CarSetup:[\s\S]*?)(?=\n[A-Za-z]|$)/);
    if (csMatch) {
      const parsed = yaml.load(csMatch[1]) as Record<string, unknown> | null;
      carSetup = (parsed?.CarSetup as Record<string, unknown>) ?? {};
    } else {
      console.warn('[ibt-parser] CarSetup block not found in session YAML');
    }

    // Extract humidity directly from raw YAML string (iRacing uses non-standard
    // ';' inline comments that break yaml.load, so regex is more reliable)
    const humidMatch = str.match(/RelativeHumidity:\s*(\d+(?:\.\d+)?)/);
    if (humidMatch) humidityPct = parseFloat(humidMatch[1]);

    const sectorMatches = [...str.matchAll(/SectorStartPct:\s*(\d+(?:\.\d+)?)/g)];
    sectors = sectorMatches.map((m) => parseFloat(m[1])).filter((v) => v > 0);

    const trackIdMatch = str.match(/TrackID:\s*(\d+)/);
    if (trackIdMatch) trackId = parseInt(trackIdMatch[1]);
  } catch (err) {
    console.error('[ibt-parser] Setup YAML parse error:', (err as Error).message);
  }

  // ── Variable descriptor map ───────────────────────────────────────────────
  const varMap: Record<string, { offset: number; type: number }> = {};
  const allVars: Array<{ name: string; type: number; offset: number; count: number }> = [];
  for (let i = 0; i < numVars; i++) {
    const pos    = varHeaderOffset + i * 144;
    const type   = buffer.readInt32LE(pos);
    const offset = buffer.readInt32LE(pos + 4);
    const count  = buffer.readInt32LE(pos + 8);
    const nameEnd = buffer.indexOf(0, pos + 16);
    const name  = buffer.subarray(pos + 16, Math.min(nameEnd, pos + 48)).toString('ascii');
    allVars.push({ name, type, offset, count });
    if (NEEDED_VARS.has(name)) {
      varMap[name] = { offset, type };
    }
  }


  if (process.env.IBT_DEBUG_CHANNELS === '1') {
    const allVarNames = allVars.map(v => v.name);
    const outPath = path.join(process.cwd(), 'docs', 'ibt-channels.md');
    const existing = fs.existsSync(outPath)
      ? new Set([...fs.readFileSync(outPath, 'utf8').matchAll(/`(\w+)`/g)].map(m => m[1]))
      : new Set<string>();
    const merged = [...new Set([...existing, ...allVarNames])].sort();
    const newOnes = allVarNames.filter(n => !existing.has(n));
    const md = `# iRacing IBT Channels\n\n${merged.map(n => `- \`${n}\``).join('\n')}\n`;
    fs.writeFileSync(outPath, md, 'utf8');
    if (newOnes.length) console.log('[ibt-parser] New channels added:', newOnes.join(', '));
    else console.log('[ibt-parser] No new channels found.');
  }

  // ── Sample extraction ─────────────────────────────────────────────────────
  // Pre-allocate Float32Array per channel — ~6× less memory than number[]
  // (avoids V8 boxing; typed arrays are released outside the managed heap).
  // Exception: double-precision channels stay as Float64Array — SessionTime is
  // used for sub-tick lap-time interpolation and must not be rounded or truncated.
  // LapDistPct must NOT be rounded — values like 0.99982 rounded to 1.0000 would
  // skip the interpolation and produce lap-time errors of up to ~8 ms at 60 Hz.
  const FLOAT64_VARS = new Set(['Lat', 'Lon', 'YawNorth', 'SessionTime', 'LapDistPct']);
  const results: Record<string, Float32Array | Float64Array> = {};
  for (const name of Object.keys(varMap)) {
    results[name] = FLOAT64_VARS.has(name)
      ? new Float64Array(numSamples)
      : new Float32Array(numSamples);
  }

  for (let s = 0; s < numSamples; s++) {
    const base = bufOffset + s * bufLen;
    for (const [name, { offset, type }] of Object.entries(varMap)) {
      const reader = DTYPE[type];
      if (!reader) continue;
      let val = reader(buffer, base + offset);
      if (name === 'SteeringWheelAngle') {
        val = Math.round(val * 57.2958 * 100) / 100; // rad → deg
      } else if (!FLOAT64_VARS.has(name) && !Number.isInteger(val)) {
        // Skip rounding for double-precision channels (GPS coords, heading, time)
        val = Math.round(val * 10000) / 10000;
      }
      results[name][s] = val;
    }
  }

  // ── Lap segmentation — exact port of reference app getLapsMap() ───────────
  // Phase 1: detect crossings (LapDistPct >0.9 → <0.1, Lap increments).
  // Phase 2: interpolate the exact SessionTime when LapDistPct=0 at each boundary.
  const laps: LapInfo[] = [];
  const lapCh   = results['Lap'];
  const distPct = results['LapDistPct'];
  const stTime  = results['SessionTime'];

  // d3 interpolateNumber equivalent: lerp(a, b)(t) = a + t*(b-a)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);

  interface Cand { startIndex: number; endIndex: number; lapNum: number; }
  const candidates: Cand[] = [];
  let cur: Partial<Cand> | null = null;
  let prevDist = 0, prevLap = 0;

  // Phase 1
  for (let a = 0; a < numSamples; a++) {
    const m = distPct[a];
    const h = lapCh[a];

    if (a && prevDist > 0.9 && m < 0.1 && prevLap < h) {
      if (cur) {
        cur.endIndex = a - 1;
        cur.lapNum   = Math.max(prevLap, candidates.length);
        candidates.push(cur as Cand);
      }
      cur = { startIndex: a };
    }

    prevDist = m;
    prevLap  = h;
  }
  // Trailing partial lap is intentionally not pushed (no complete end crossing).

  // Phase 2: precise crossing times
  for (const { startIndex, endIndex, lapNum } of candidates) {
    // ── sessionTimeStart ────────────────────────────────────────────────────
    let sessionTimeStart: number;
    let r = startIndex, s = startIndex - 1;

    if (distPct[r] === 0) {
      sessionTimeStart = stTime[r];
    } else if (distPct[r] < 0 || distPct[s] > 1) {
      s = startIndex + 1;
      const t = -distPct[r] * (1 / (distPct[s] - distPct[r]));
      sessionTimeStart = lerp(stTime[r], stTime[s], t);
    } else {
      const t = distPct[r] / (1 - distPct[s] + distPct[r]);
      sessionTimeStart = lerp(stTime[r], stTime[s], t);
    }

    // ── sessionTimeEnd ──────────────────────────────────────────────────────
    let sessionTimeEnd: number;
    r = endIndex + 1;
    s = endIndex;

    if (distPct[r] <= 0) {
      sessionTimeEnd = stTime[r];
    } else if (distPct[s] >= 1) {
      sessionTimeEnd = stTime[s];
    } else {
      const t = distPct[r] / (1 - distPct[s] + distPct[r]);
      sessionTimeEnd = lerp(stTime[r], stTime[s], t);
    }

    const lapTime = sessionTimeEnd - sessionTimeStart;

    laps.push({
      lap:        lapNum,
      start_idx:  startIndex,
      end_idx:    endIndex,
      lap_time_s: lapTime,
      duration_s: Math.round((endIndex - startIndex + 1) / tickRate * 1000) / 1000,
    });
  }

  return {
    meta: {
      source_file:  filename,
      tick_rate_hz: tickRate,
      sample_count: numSamples,
      humidity_pct: humidityPct,
      sectors,
      track_id: trackId,
    },
    laps,
    data: results,
    setup: carSetup,
    _filename: filename.replace(/\.ibt$/i, ''),
  };
}
