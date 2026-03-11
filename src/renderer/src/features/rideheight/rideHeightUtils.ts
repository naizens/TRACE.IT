import type { ChartData, ChartOptions } from 'chart.js';
import type { ParsedSession } from '../../types/session';
import type { LapSelections } from '../../types/session';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { arrayMax, darken } from '../../lib/formatters';
import { buildZoomPlugin, buildClickHandler, type HoverRef, type ZoomRef } from '../../lib/syncChartConfig';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MM = 1000; // m → mm

export const CH = {
  lapDist: 'LapDist',
  lf: 'LFrideHeight',
  rf: 'RFrideHeight',
  lr: 'LRrideHeight',
  rr: 'RRrideHeight',
} as const;

// ── Options factory ───────────────────────────────────────────────────────────

export function createRideOptions(
  id: string,
  zoomRef: ZoomRef,
  hoverRef: HoverRef,
): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    events: ['click' as const],
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      decimation: { enabled: true, algorithm: 'lttb', threshold: 500 },
      tooltip: {
        backgroundColor: 'rgba(9, 9, 11, 0.92)',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: { x: 8, y: 5 },
        displayColors: false,
        titleColor: '#52525b',
        titleFont: { size: 9 },
        bodyFont: { family: 'monospace', size: 11, weight: 'bold' },
        callbacks: {
          title: (items) => `${items[0].parsed.x} m`,
          label: (item) => `${(item.dataset.label as string).split(' ').pop()}: ${(item.parsed.y as number).toFixed(1)} mm`,
          labelTextColor: (item) => item.dataset.borderColor as string,
        },
      },
      zoom: buildZoomPlugin(id, zoomRef),
    },
    scales: {
      x: {
        type: 'linear',
        ticks: {
          color: '#52525b',
          font: { size: 9 },
          maxRotation: 0,
          callback: (v) => `${v}m`,
          maxTicksLimit: 12,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
      y: {
        title: { display: true, text: 'mm', color: '#52525b', font: { size: 10 } },
        ticks: { color: '#52525b', font: { size: 9 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
    },
    onClick: buildClickHandler(id, hoverRef),
  };
}

// ── Data builder ──────────────────────────────────────────────────────────────

export interface RideChartData {
  splitter: ChartData<'line'>;
  front:    ChartData<'line'>;
  rear:     ChartData<'line'>;
  maxDist:  number;
}

export function buildRideData(
  sessions: ParsedSession[],
  selections: LapSelections,
): RideChartData | null {
  if (sessions.length === 0 || Object.keys(selections).length === 0) return null;

  const multiSession = sessions.length > 1;

  const usedSessions = new Set(
    Object.keys(selections).map((k) => parseInt(k.split(':')[0])),
  );
  let maxDist = 0;
  for (const si of usedSessions) {
    const arr = sessions[si]?.data[CH.lapDist] ?? new Float32Array();
    if (arr.length > 0) maxDist = Math.max(maxDist, arrayMax(arr));
  }
  if (maxDist === 0) return null;

  const resolution = Math.ceil(maxDist);
  const axis = Array.from({ length: resolution }, (_, i) => (maxDist / resolution) * i);

  const splitterDatasets: ChartData<'line'>['datasets'] = [];
  const frontDatasets:    ChartData<'line'>['datasets'] = [];
  const rearDatasets:     ChartData<'line'>['datasets'] = [];

  const sorted = Object.entries(selections)
    .map(([key, color]) => {
      const colon      = key.indexOf(':');
      const sessionIdx = parseInt(key.substring(0, colon));
      const lapIdx     = parseInt(key.substring(colon + 1));
      const sess       = sessions[sessionIdx];
      if (!sess) return null;
      const lap = sess.laps[lapIdx];
      if (!lap) return null;
      return { color, sessionIdx, lapNum: lap.lap, lap, sess };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));

  for (const { color, sessionIdx, lapNum, lap, sess } of sorted) {
    const hex   = getLapColor(color);
    const label = multiSession ? `S${sessionIdx + 1}·L${lapNum}` : `L${lapNum}`;

    const s = lap.start_idx;
    const e = lap.end_idx + 1;
    const d = sess.data;

    const dist = (d[CH.lapDist] ?? new Float32Array()).slice(s, e);
    const lf   = (d[CH.lf]      ?? new Float32Array()).slice(s, e);
    const rf   = (d[CH.rf]      ?? new Float32Array()).slice(s, e);
    const lr   = (d[CH.lr]      ?? new Float32Array()).slice(s, e);
    const rr   = (d[CH.rr]      ?? new Float32Array()).slice(s, e);

    const resample = (arr: ArrayLike<number>) =>
      axis.map((x) => ({ x: Math.round(x), y: interpolate(dist, arr, x) * MM }));

    const baseStyle = {
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
      normalized: true,
    } as const;

    const splitterRaw = lf.map((v, i) => (v + (rf[i] ?? 0)) / 2);
    splitterDatasets.push({ ...baseStyle, label,           borderColor: hex,               data: resample(splitterRaw) });
    frontDatasets.push(   { ...baseStyle, label: `${label} LF`, borderColor: hex,               data: resample(lf) });
    frontDatasets.push(   { ...baseStyle, label: `${label} RF`, borderColor: darken(hex, 0.45), data: resample(rf) });
    rearDatasets.push(    { ...baseStyle, label: `${label} LR`, borderColor: hex,               data: resample(lr) });
    rearDatasets.push(    { ...baseStyle, label: `${label} RR`, borderColor: darken(hex, 0.45), data: resample(rr) });
  }

  return {
    splitter: { datasets: splitterDatasets },
    front:    { datasets: frontDatasets },
    rear:     { datasets: rearDatasets },
    maxDist,
  };
}
