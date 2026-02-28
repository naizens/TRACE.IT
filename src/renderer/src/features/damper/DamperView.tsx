import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { Chart, ChartData, ChartOptions, Plugin } from 'chart.js';
import { useStore } from '../../store/useStore';
import { LAP_COLORS, COLOR_ORDER } from '../../lib/constants';

// ── Histogram axis ─────────────────────────────────────────────────────────────
// Bin CENTERS spaced evenly with BIN_STEP, symmetric around 0.
// 0 is always an exact bin center → X-axis is truly centered.

const BIN_STEP = 5; // mm/s

const RANGE_OPTIONS = [200, 250, 300] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

function makeBins(range: RangeOption) {
  const count  = (range * 2) / BIN_STEP + 1;
  const labels = Array.from({ length: count }, (_, i) => String(-range + i * BIN_STEP));
  return { count, labels };
}

// ── Corners ───────────────────────────────────────────────────────────────────

const CORNERS = [
  { key: 'LFshockVel', label: 'Left Front'  },
  { key: 'RFshockVel', label: 'Right Front' },
  { key: 'LRshockVel', label: 'Left Rear'   },
  { key: 'RRshockVel', label: 'Right Rear'  },
] as const;

const LS_THRESHOLDS = [25, 50, 75, 100] as const;
type LsThreshold = typeof LS_THRESHOLDS[number];

// ── Histogram computation ─────────────────────────────────────────────────────

function buildHistogram(
  rawMs: Float32Array,
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
    const mm  = v * 1000; // m/s → mm/s
    const idx = Math.round((mm - rangeMin) / BIN_STEP);
    if (idx >= 0 && idx < binCount) { bins[idx]++; total++; }
  }
  const data = total > 0 ? bins.map((c) => (c / total) * 100) : bins;

  // Per-bar colors: brighter inside LS zone, dimmer in HS zone
  const bg: string[]     = binLabels.map((lbl) =>
    Math.abs(Number(lbl)) <= lsThreshold ? `${hexColor}66` : `${hexColor}28`,
  );
  const border: string[] = binLabels.map((lbl) =>
    Math.abs(Number(lbl)) <= lsThreshold ? `${hexColor}cc` : `${hexColor}66`,
  );

  return { data, bg, border };
}

// ── LS/HS overlay plugin ──────────────────────────────────────────────────────

function makeLsBandPlugin(lsThreshold: number, range: RangeOption): Plugin<'bar'> {
  const rangeMin = -range;
  // Bin indices for ±threshold are exact because centers are integer multiples of BIN_STEP
  const negIdx = ((-lsThreshold) - rangeMin) / BIN_STEP;
  const posIdx = (( lsThreshold) - rangeMin) / BIN_STEP;

  return {
    id: `lsBand-${lsThreshold}-${range}`,
    afterDatasetsDraw(chart: Chart) {
      const { ctx, chartArea, scales } = chart;
      const xScale = scales['x'];
      if (!xScale || !chartArea) return;

      const x1 = xScale.getPixelForValue(negIdx);
      const x2 = xScale.getPixelForValue(posIdx);
      const { top, bottom } = chartArea;

      ctx.save();

      // Subtle LS zone fill
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x1, top, x2 - x1, bottom - top);

      // Threshold lines
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x1, top); ctx.lineTo(x1, bottom);
      ctx.moveTo(x2, top); ctx.lineTo(x2, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Zone labels
      ctx.font      = 'bold 9px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = top + 5;

      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillText('LS', (x1 + x2) / 2, labelY);

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('HS RBD', (chartArea.left + x1) / 2, labelY);
      ctx.fillText('HS COMP', (x2 + chartArea.right)  / 2, labelY);

      ctx.restore();
    },
  };
}

// ── Chart options factory ─────────────────────────────────────────────────────

function makeChartOptions(range: RangeOption): ChartOptions<'bar'> {
  const rangeMin = -range;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
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
          autoSkip: false, // manual filter so 0 is always shown
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

// ── Single corner panel ───────────────────────────────────────────────────────

interface CornerHistogramProps {
  label: string;
  chartData: ChartData<'bar'>;
  chartOptions: ChartOptions<'bar'>;
  lsBandPlugin: Plugin<'bar'>;
  /** Changes when threshold or range change — forces chart remount so the plugin closure is fresh. */
  chartKey: string;
}

function CornerHistogram({ label, chartData, chartOptions, lsBandPlugin, chartKey }: CornerHistogramProps) {
  return (
    <div className="flex flex-col bg-surface rounded-lg p-3 min-h-0 overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2 shrink-0">
        {label}
      </span>
      <div className="flex-1 relative min-h-0">
        <Bar key={chartKey} data={chartData} options={chartOptions} plugins={[lsBandPlugin]} />
      </div>
    </div>
  );
}

// ── DamperView ────────────────────────────────────────────────────────────────

export function DamperView() {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);

  const [lsThreshold, setLsThreshold] = useState<LsThreshold>(50);
  const [range, setRange]             = useState<RangeOption>(200);

  const { labels: binLabels } = useMemo(() => makeBins(range), [range]);

  const lsBandPlugin = useMemo(
    () => makeLsBandPlugin(lsThreshold, range),
    [lsThreshold, range],
  );

  const chartOptions = useMemo(() => makeChartOptions(range), [range]);

  const cornerChartData = useMemo((): ChartData<'bar'>[] => {
    const empty = (): ChartData<'bar'> => ({ labels: binLabels, datasets: [] });

    if (sessions.length === 0) return CORNERS.map(empty);

    const multiSession = sessions.length > 1;

    const selectedLaps = COLOR_ORDER
      .filter((color) => Object.values(selections).includes(color))
      .map((color) => {
        const key = Object.keys(selections).find((k) => selections[k] === color);
        if (!key) return null;
        const colon      = key.indexOf(':');
        const sessionIdx = parseInt(key.substring(0, colon));
        const lapIdx     = parseInt(key.substring(colon + 1));
        const sess       = sessions[sessionIdx];
        if (!sess) return null;
        const lapInfo = sess.laps[lapIdx];
        if (!lapInfo) return null;
        return { color, lapInfo, session: sess, sessionIdx };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (selectedLaps.length === 0) return CORNERS.map(empty);

    const multiLap = selectedLaps.length > 1;

    return CORNERS.map(({ key }) => ({
      labels: binLabels,
      datasets: selectedLaps.map(({ color, lapInfo, session: sess, sessionIdx }) => {
        const raw      = sess.data[key]?.slice(lapInfo.start_idx, lapInfo.end_idx + 1) ?? [];
        const hexColor = LAP_COLORS[color];
        const { data, bg, border } = buildHistogram(raw, range, binLabels, lsThreshold, hexColor);
        return {
          label: multiSession ? `S${sessionIdx + 1}·L${lapInfo.lap}` : `L${lapInfo.lap}`,
          data,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          // single lap: fill full bar width; multiple laps: side-by-side grouped bars
          grouped: multiLap,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        };
      }),
    }));
  }, [sessions, selections, lsThreshold, range, binLabels]);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        Open an IBT file to view damper histograms.
      </div>
    );
  }

  const hasShockData = (sessions[0]?.data['LFshockVel']?.length ?? 0) > 0;
  if (!hasShockData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No shock velocity data found in this IBT file.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-4 gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Damper Histograms
          </span>
          <span className="text-[10px] text-muted">· shock velocity · mm/s</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Range selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted uppercase tracking-wider">Range</span>
            <div className="flex rounded overflow-hidden border border-border">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={[
                    'px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors',
                    range === r
                      ? 'bg-accent text-black'
                      : 'text-muted hover:text-text hover:bg-surface-2',
                  ].join(' ')}
                >
                  ±{r}
                </button>
              ))}
            </div>
          </div>

          {/* LS/HS threshold selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted uppercase tracking-wider">LS/HS split</span>
            <div className="flex rounded overflow-hidden border border-border">
              {LS_THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setLsThreshold(t)}
                  className={[
                    'px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors',
                    lsThreshold === t
                      ? 'bg-accent text-black'
                      : 'text-muted hover:text-text hover:bg-surface-2',
                  ].join(' ')}
                >
                  ±{t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2 × 2 grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 min-h-0">
        {CORNERS.map((corner, i) => (
          <CornerHistogram
            key={corner.key}
            label={corner.label}
            chartData={cornerChartData[i]}
            chartOptions={chartOptions}
            lsBandPlugin={lsBandPlugin}
            chartKey={`${lsThreshold}-${range}`}
          />
        ))}
      </div>
    </div>
  );
}
