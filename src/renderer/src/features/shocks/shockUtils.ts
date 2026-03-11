import type { ChartData, ChartOptions, Plugin, Chart } from 'chart.js';
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
  lf: 'LFshockDefl',
  rf: 'RFshockDefl',
  lr: 'LRshockDefl',
  rr: 'RRshockDefl',
} as const;

// ── Bump rubber gap extraction ────────────────────────────────────────────────

export function parseBumpRubberGap(setup: Record<string, unknown>, axle: 'front' | 'rear'): number | null {
  const chassis = setup['Chassis'] as Record<string, unknown> | undefined;
  if (!chassis) return null;

  const candidateKeys = axle === 'front'
    ? ['Front', 'LeftFront', 'RightFront']
    : ['Rear', 'LeftRear', 'RightRear'];

  const values: number[] = [];
  for (const key of candidateKeys) {
    const section = chassis[key] as Record<string, unknown> | undefined;
    if (!section) continue;
    const raw = section['BumpRubberGap'];
    if (raw == null) continue;
    const parsed = parseFloat(String(raw));
    if (!isNaN(parsed)) values.push(parsed);
  }

  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Bump rubber gap plugin ────────────────────────────────────────────────────

export function makeBumpRubberPlugin(gapMm: number | null, pluginId: string): Plugin<'line'> {
  return {
    id: pluginId,
    afterDatasetsDraw(chart: Chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;

      if (gapMm === null) {
        ctx.save();
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Bump rubber gap: None', chartArea.right, chartArea.top + 4);
        ctx.restore();
        return;
      }

      const yScale = scales['y'];
      if (!yScale) return;
      const y = yScale.getPixelForValue(gapMm);

      ctx.save();
      ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 200, 0, 0.70)';
      ctx.textAlign = 'right';

      if (y < chartArea.top) {
        ctx.textBaseline = 'top';
        ctx.fillText(`BR gap ${gapMm.toFixed(0)} mm ↑`, chartArea.right, chartArea.top + 4);
      } else if (y > chartArea.bottom) {
        ctx.textBaseline = 'bottom';
        ctx.fillText(`BR gap ${gapMm.toFixed(0)} mm ↓`, chartArea.right, chartArea.bottom - 4);
      } else {
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.55)';
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textBaseline = 'bottom';
        ctx.fillText(`BR gap ${gapMm.toFixed(0)} mm`, chartArea.right, y - 2);
      }

      ctx.restore();
    },
  };
}

// ── Options factory ───────────────────────────────────────────────────────────

export function createShockOptions(
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
          label: (item) =>
            `${(item.dataset.label as string).split(' ').pop()}: ${(item.parsed.y as number).toFixed(1)} mm`,
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

export interface ShockChartData {
  front:   ChartData<'line'>;
  rear:    ChartData<'line'>;
  maxDist: number;
}

export function buildShockData(
  sessions: ParsedSession[],
  selections: LapSelections,
): ShockChartData | null {
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

  const frontDatasets: ChartData<'line'>['datasets'] = [];
  const rearDatasets:  ChartData<'line'>['datasets'] = [];

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

    frontDatasets.push({ ...baseStyle, label: `${label} LF`, borderColor: hex,               data: resample(lf) });
    frontDatasets.push({ ...baseStyle, label: `${label} RF`, borderColor: darken(hex, 0.45), data: resample(rf) });
    rearDatasets.push({  ...baseStyle, label: `${label} LR`, borderColor: hex,               data: resample(lr) });
    rearDatasets.push({  ...baseStyle, label: `${label} RR`, borderColor: darken(hex, 0.45), data: resample(rr) });
  }

  return {
    front: { datasets: frontDatasets },
    rear:  { datasets: rearDatasets },
    maxDist,
  };
}
