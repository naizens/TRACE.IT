import { useMemo, useRef, useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import type { Chart, ChartData, ChartOptions, Plugin } from 'chart.js';
import { useStore } from '../../store/useStore';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';

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

interface ZoneStat {
  lapLabel: string;
  hexColor: string;
  hsRbd:   number; // % vel < -lsThreshold
  lsRbd:   number; // % -lsThreshold <= vel < 0
  lsComp:  number; // % 0 <= vel <= lsThreshold
  hsComp:  number; // % vel > +lsThreshold
  avgRbd:  number; // mean |mm/s| of rebound-side samples
  avgComp: number; // mean  mm/s  of bump-side samples
}

function buildHistogram(
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

function computeZones(
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
// Stats are drawn in the layout.padding.top space above the chart area,
// aligned with the four velocity zones (HS RBD | LS RBD | LS COMP | HS COMP).

const ROW_H      = 13; // px per lap value row
const LABEL_H    = 10; // approx px height of label text
const GAP        = 7;  // px gap between label row bottom and first value row

// statsRef.current[cornerIdx] is updated every render — the plugin always reads
// the latest value without needing to remount the chart on selection change.
function makeLsBandPlugin(
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

      // ── LS zone fill ──────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x1, top, x2 - x1, bottom - top);

      // ── Threshold lines ───────────────────────────────────────────────────
      ctx.setLineDash([3, 4]);
      ctx.lineWidth   = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x1, top); ctx.lineTo(x1, bottom);
      ctx.moveTo(x2, top); ctx.lineTo(x2, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Stats header (drawn in layout.padding.top space above chartArea) ──
      if (stats.length === 0) { ctx.restore(); return; }

      const numLaps   = stats.length;
      const lastValY  = top - GAP;                           // bottom of last value row
      const firstValY = lastValY - (numLaps - 1) * ROW_H;   // top of first value row
      const labelY    = firstValY - GAP - LABEL_H;           // top of label row

      // Zone center x-positions (used for both labels and values)
      const zoneCx = [
        (left + x1) / 2,   // HS RBD
        (x1  + x0)  / 2,   // LS RBD
        (x0  + x2)  / 2,   // LS COMP
        (x2  + right) / 2, // HS COMP
      ];
      const ZONE_LABELS = ['HS RBD%', 'LS RBD%', 'LS COMP%', 'HS COMP%'];

      // ── Label row ─────────────────────────────────────────────────────────
      ctx.font         = '9px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.38)';
      ctx.textBaseline = 'top';
      ctx.textAlign    = 'center';
      ZONE_LABELS.forEach((lbl, i) => ctx.fillText(lbl, zoneCx[i], labelY));

      // ── Per-lap value rows ────────────────────────────────────────────────
      stats.forEach((s, lapIdx) => {
        const y = firstValY + lapIdx * ROW_H;
        ctx.font      = 'bold 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = s.hexColor;

        // Lap label on far left (only when comparing multiple laps)
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

function makeChartOptions(range: RangeOption): ChartOptions<'bar'> {
  const rangeMin = -range;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { top: 64 } }, // headroom for stats header (3 laps × 13px + labels + gaps)
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

// ── Single corner panel ───────────────────────────────────────────────────────

interface CornerHistogramProps {
  label:        string;
  chartData:    ChartData<'bar'>;
  chartOptions: ChartOptions<'bar'>;
  plugin:       Plugin<'bar'>;
  /** Changes when threshold or range change — forces chart remount so the plugin closure is fresh. */
  chartKey:     string;
}

function CornerHistogram({ label, chartData, chartOptions, plugin, chartKey }: CornerHistogramProps) {
  return (
    <div className="flex flex-col bg-surface rounded-lg p-3 min-h-0 overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 shrink-0">
        {label}
      </span>
      <div className="flex-1 relative min-h-0">
        <Bar key={chartKey} data={chartData} options={chartOptions} plugins={[plugin]} />
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
  const [visibleCorners, setVisibleCorners] = useState<Set<string>>(
    () => new Set(CORNERS.map((c) => c.key)),
  );
  const toggleCorner = useCallback((key: string) => {
    setVisibleCorners((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const { labels: binLabels } = useMemo(() => makeBins(range), [range]);

  const chartOptions = useMemo(() => makeChartOptions(range), [range]);

  // Mutable ref read by the plugin on every draw — always current, no chart remount needed.
  const statsRef = useRef<ZoneStat[][]>(CORNERS.map(() => []));

  const { cornerChartData, cornerZoneStats } = useMemo(() => {
    const emptyChart = (): ChartData<'bar'> => ({ labels: binLabels, datasets: [] });
    const noData = {
      cornerChartData: CORNERS.map(emptyChart),
      cornerZoneStats: CORNERS.map((): ZoneStat[] => []),
    };

    if (sessions.length === 0) return noData;

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

    if (selectedLaps.length === 0) return noData;

    const multiLap = selectedLaps.length > 1;

    const cornerChartData:  ChartData<'bar'>[] = [];
    const cornerZoneStats:  ZoneStat[][]       = [];

    for (const { key } of CORNERS) {
      const datasets:    ChartData<'bar'>['datasets'] = [];
      const cornerStats: ZoneStat[]                  = [];

      for (const { color, lapInfo, session: sess, sessionIdx } of selectedLaps) {
        const raw      = sess.data[key]?.slice(lapInfo.start_idx, lapInfo.end_idx + 1) ?? new Float32Array();
        const hexColor = getLapColor(color);
        const lapLabel = multiSession ? `S${sessionIdx + 1}·L${lapInfo.lap}` : `L${lapInfo.lap}`;
        const { data, bg, border } = buildHistogram(raw, range, binLabels, lsThreshold, hexColor);
        const zones = computeZones(raw, lsThreshold);

        datasets.push({
          label: lapLabel,
          data,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          grouped: multiLap,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        });
        cornerStats.push({ lapLabel, hexColor, ...zones });
      }

      cornerChartData.push({ labels: binLabels, datasets });
      cornerZoneStats.push(cornerStats);
    }

    return { cornerChartData, cornerZoneStats };
  }, [sessions, selections, lsThreshold, range, binLabels]);

  // Sync stats into the ref every render so the plugin closure reads the latest values.
  statsRef.current = cornerZoneStats;

  // Plugins recreated only when threshold/range change (chart remounts via chartKey).
  // They read live data from statsRef on every draw — no stale closure.
  const cornerPlugins = useMemo(
    () => CORNERS.map((_, i) => makeLsBandPlugin(lsThreshold, range, statsRef, i)),
    [lsThreshold, range],
  );

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

        {/* Corner toggles */}
        <div className="flex items-center gap-1.5">
          {CORNERS.map((c) => {
            const active = visibleCorners.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCorner(c.key)}
                className={[
                  'px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors',
                  active ? 'border-border bg-surface-2 text-text' : 'border-border/30 text-muted/40',
                ].join(' ')}
              >
                {c.key.replace('shockVel', '')}
              </button>
            );
          })}
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

      {/* 2-col grid, rows adapt to visible count */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${Math.ceil(visibleCorners.size / 2)}, 1fr)` }}>
        {CORNERS.map((corner, i) => visibleCorners.has(corner.key) && (
          <CornerHistogram
            key={corner.key}
            label={corner.label}
            chartData={cornerChartData[i]}
            chartOptions={chartOptions}
            plugin={cornerPlugins[i]}
            chartKey={`${lsThreshold}-${range}`}
          />
        ))}
      </div>
    </div>
  );
}
