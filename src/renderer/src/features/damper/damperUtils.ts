import type { Chart, ChartData, ChartOptions, Plugin } from 'chart.js';

// ── Histogram axis ─────────────────────────────────────────────────────────────

export const BIN_STEP = 5; // mm/s

export const RANGE_OPTIONS = [200, 250, 300] as const;
export type RangeOption = typeof RANGE_OPTIONS[number];

export function makeBins(range: RangeOption) {
  const count  = (range * 2) / BIN_STEP + 1;
  const labels = Array.from({ length: count }, (_, i) => String(-range + i * BIN_STEP));
  return { count, labels };
}

// ── Zone statistics ────────────────────────────────────────────────────────────

export const LS_THRESHOLDS = [25, 50, 75, 100] as const;
export type LsThreshold = typeof LS_THRESHOLDS[number];

export interface ZoneStat {
  lapLabel: string;
  hexColor: string;
  hsRbd:   number;
  lsRbd:   number;
  lsComp:  number;
  hsComp:  number;
  avgRbd:  number;
  avgComp: number;
}

// ── Histogram computation ─────────────────────────────────────────────────────

export function buildHistogram(
  rawMs: Float32Array | Float64Array,
  range: RangeOption,
  binLabels: string[],
  lsThreshold: number,
  hexColor: string,
): { data: number[]; bg: string[]; border: string[] } {
  const rangeMin = -range;
  const binCount = binLabels.length;
  const bins = new Array(binCount).fill(0);
  let total  = 0;
  for (const v of rawMs) {
    const mm  = v * 1000;
    const idx = Math.round((mm - rangeMin) / BIN_STEP);
    if (idx >= 0 && idx < binCount) { bins[idx]++; total++; }
  }
  const data = total > 0 ? bins.map((c) => (c / total) * 100) : bins;

  const bg: string[]     = binLabels.map((lbl) =>
    Math.abs(Number(lbl)) <= lsThreshold ? `${hexColor}66` : `${hexColor}28`,
  );
  const border: string[] = binLabels.map((lbl) =>
    Math.abs(Number(lbl)) <= lsThreshold ? `${hexColor}cc` : `${hexColor}66`,
  );

  return { data, bg, border };
}

export function computeZones(
  rawMs: Float32Array | ArrayLike<number>,
  lsThreshold: number,
): Pick<ZoneStat, 'hsRbd' | 'lsRbd' | 'lsComp' | 'hsComp' | 'avgRbd' | 'avgComp'> {
  let hsRbd = 0, lsRbd = 0, lsComp = 0, hsComp = 0, total = 0;
  let sumRbd = 0, cntRbd = 0, sumComp = 0, cntComp = 0;

  for (let i = 0; i < rawMs.length; i++) {
    const mm = (rawMs as Float32Array)[i] * 1000;
    if (mm < -lsThreshold) {
      hsRbd++; sumRbd += Math.abs(mm); cntRbd++;
    } else if (mm < 0) {
      lsRbd++; sumRbd += Math.abs(mm); cntRbd++;
    } else if (mm <= lsThreshold) {
      lsComp++; sumComp += mm; cntComp++;
    } else {
      hsComp++; sumComp += mm; cntComp++;
    }
    total++;
  }

  if (total === 0) return { hsRbd: 0, lsRbd: 0, lsComp: 0, hsComp: 0, avgRbd: 0, avgComp: 0 };
  return {
    hsRbd:   (hsRbd  / total) * 100,
    lsRbd:   (lsRbd  / total) * 100,
    lsComp:  (lsComp / total) * 100,
    hsComp:  (hsComp / total) * 100,
    avgRbd:  cntRbd  > 0 ? sumRbd  / cntRbd  : 0,
    avgComp: cntComp > 0 ? sumComp / cntComp : 0,
  };
}

// ── LS/HS overlay + stats header plugin ───────────────────────────────────────

const ROW_H   = 13; // px per lap value row
const LABEL_H = 10; // approx px height of label text
const GAP     = 7;  // px gap between label row bottom and first value row

export function makeLsBandPlugin(
  lsThreshold: number,
  range: RangeOption,
  statsRef: { current: ZoneStat[][] },
  cornerIdx: number,
): Plugin<'bar'> {
  const rangeMin = -range;
  const negIdx   = ((-lsThreshold) - rangeMin) / BIN_STEP;
  const posIdx   = (( lsThreshold) - rangeMin) / BIN_STEP;
  const zeroIdx  = range / BIN_STEP;

  return {
    id: `lsBand-${lsThreshold}-${range}-${cornerIdx}`,
    afterDatasetsDraw(chart: Chart) {
      const stats  = statsRef.current[cornerIdx] ?? [];
      const { ctx, chartArea, scales } = chart;
      const xScale = scales['x'];
      if (!xScale || !chartArea) return;

      const x1 = xScale.getPixelForValue(negIdx);
      const x2 = xScale.getPixelForValue(posIdx);
      const x0 = xScale.getPixelForValue(zeroIdx);
      const { top, bottom, left, right } = chartArea;

      ctx.save();

      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x1, top, x2 - x1, bottom - top);

      ctx.setLineDash([3, 4]);
      ctx.lineWidth   = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x1, top); ctx.lineTo(x1, bottom);
      ctx.moveTo(x2, top); ctx.lineTo(x2, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (stats.length === 0) { ctx.restore(); return; }

      const numLaps   = stats.length;
      const lastValY  = top - GAP;
      const firstValY = lastValY - (numLaps - 1) * ROW_H;
      const labelY    = firstValY - GAP - LABEL_H;

      const zoneCx = [
        (left + x1) / 2,
        (x1  + x0)  / 2,
        (x0  + x2)  / 2,
        (x2  + right) / 2,
      ];
      const ZONE_LABELS = ['HS RBD%', 'LS RBD%', 'LS COMP%', 'HS COMP%'];

      ctx.font         = '9px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.38)';
      ctx.textBaseline = 'top';
      ctx.textAlign    = 'center';
      ZONE_LABELS.forEach((lbl, i) => ctx.fillText(lbl, zoneCx[i], labelY));

      stats.forEach((s, lapIdx) => {
        const y = firstValY + lapIdx * ROW_H;
        ctx.font      = 'bold 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = s.hexColor;

        if (numLaps > 1) {
          ctx.textAlign = 'left';
          ctx.font      = 'bold 9px ui-sans-serif, system-ui, sans-serif';
          ctx.fillText(s.lapLabel, left + 4, y);
          ctx.font      = 'bold 10px ui-sans-serif, system-ui, sans-serif';
        }

        ctx.textAlign = 'center';
        [s.hsRbd, s.lsRbd, s.lsComp, s.hsComp].forEach((pct, i) =>
          ctx.fillText(pct.toFixed(1), zoneCx[i], y),
        );
      });

      ctx.restore();
    },
  };
}

// ── Chart options factory ─────────────────────────────────────────────────────

export function makeChartOptions(range: RangeOption): ChartOptions<'bar'> {
  const rangeMin = -range;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { top: 64 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title:  (items) => `${items[0].label} mm/s`,
          label:  (item)  => `${(item.parsed.y as number).toFixed(2)} %`,
        },
      },
      zoom: {
        zoom: { wheel: { enabled: false }, pinch: { enabled: false } },
        pan:  { enabled: false },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'mm/s', color: '#52525b', font: { size: 10 } },
        ticks: {
          color: '#52525b',
          font: { size: 9 },
          maxRotation: 0,
          autoSkip: false,
          callback: (_value, index) => {
            const mm = rangeMin + index * BIN_STEP;
            return mm % 50 === 0 ? String(mm) : undefined;
          },
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        title: { display: true, text: '%', color: '#52525b', font: { size: 10 } },
        ticks: { color: '#52525b', font: { size: 9 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        beginAtZero: true,
      },
    },
  };
}

// Re-export for convenience
export type { ChartData };
