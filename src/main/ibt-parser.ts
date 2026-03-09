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
  };
  laps: LapInfo[];
  data: Record<string, Float32Array>;
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
  'SessionTime', 'Lap', 'LapDist', 'Throttle', 'Brake',
  'SteeringWheelAngle', 'Speed', 'LapLastLapTime', 'Gear', 'RPM',
  // Live setup data
  'FuelLevel', 'DcBrakeBias',
  'LFpressure', 'RFpressure', 'LRpressure', 'RRpressure',
  'LFtempL', 'LFtempM', 'LFtempR',
  'RFtempL', 'RFtempM', 'RFtempR',
  'LRtempL', 'LRtempM', 'LRtempR',
  'RRtempL', 'RRtempM', 'RRtempR',
  'LFrideHeight', 'RFrideHeight', 'LRrideHeight', 'RRrideHeight',
  // Track-map dead reckoning
  'Yaw',
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
  try {
    const raw = buffer.slice(sessionInfoOffset, sessionInfoOffset + sessionInfoLen);
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
  } catch (err) {
    console.error('[ibt-parser] Setup YAML parse error:', (err as Error).message);
  }

  // ── Variable descriptor map ───────────────────────────────────────────────
  const varMap: Record<string, { offset: number; type: number }> = {};
  const allVarNames: string[] = [];
  for (let i = 0; i < numVars; i++) {
    const pos    = varHeaderOffset + i * 144;
    const type   = buffer.readInt32LE(pos);
    const offset = buffer.readInt32LE(pos + 4);
    const nameEnd = buffer.indexOf(0, pos + 16);
    const name  = buffer.slice(pos + 16, Math.min(nameEnd, pos + 48)).toString('ascii');
    allVarNames.push(name);
    if (NEEDED_VARS.has(name)) {
      varMap[name] = { offset, type };
    }
  }
  if (process.env.IBT_DEBUG_CHANNELS === '1') {
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
  const results: Record<string, Float32Array> = {};
  for (const name of Object.keys(varMap)) results[name] = new Float32Array(numSamples);

  for (let s = 0; s < numSamples; s++) {
    const base = bufOffset + s * bufLen;
    for (const [name, { offset, type }] of Object.entries(varMap)) {
      const reader = DTYPE[type];
      if (!reader) continue;
      let val = reader(buffer, base + offset);
      if (name === 'SteeringWheelAngle') {
        val = Math.round(val * 57.2958 * 100) / 100; // rad → deg
      } else if (!Number.isInteger(val)) {
        val = Math.round(val * 10000) / 10000;
      }
      results[name][s] = val;
    }
  }

  // ── Lap segmentation ─────────────────────────────────────────────────────
  const laps: LapInfo[] = [];
  const ln  = results['Lap'];
  const llt = results['LapLastLapTime'];
  let startIdx   = 0;
  let currentLap = ln[0];

  for (let i = 1; i < ln.length; i++) {
    if (ln[i] !== currentLap) {
      const endIdx = i - 1;

      // iRacing writes LapLastLapTime a few ticks after crossing the line
      let lapTime = 0;
      const lookAheadLimit = Math.min(i + 30, llt.length);
      for (let k = i; k < lookAheadLimit; k++) {
        if (llt[k] > 0 && llt[k] !== llt[i - 1]) { lapTime = llt[k]; break; }
      }
      // Fallback: compute from sample count (e.g. out-lap with lapTime=0)
      if (lapTime <= 0) lapTime = (endIdx - startIdx + 1) / tickRate;

      if (endIdx - startIdx > 10) {
        laps.push({
          lap:        parseInt(String(currentLap)),
          start_idx:  startIdx,
          end_idx:    endIdx,
          lap_time_s: Math.round(lapTime * 1000) / 1000,
          duration_s: Math.round((endIdx - startIdx + 1) / tickRate * 1000) / 1000,
        });
      }
      startIdx   = i;
      currentLap = ln[i];
    }
  }
  // Append the final (possibly incomplete) lap
  if (startIdx < ln.length) {
    laps.push({
      lap:        parseInt(String(currentLap)),
      start_idx:  startIdx,
      end_idx:    ln.length - 1,
      lap_time_s: 0,
      duration_s: Math.round((ln.length - 1 - startIdx) / tickRate * 1000) / 1000,
    });
  }

  return {
    meta: {
      source_file:  filename,
      tick_rate_hz: tickRate,
      sample_count: numSamples,
      humidity_pct: humidityPct,
    },
    laps,
    data: results,
    setup: carSetup,
    _filename: filename.replace(/\.ibt$/i, ''),
  };
}
