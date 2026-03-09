import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import type { RefObject } from 'react';
import type { ChartOptions } from 'chart.js';
import type { Chart } from 'chart.js';
import { useStore } from '../../store/useStore';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { arrayMax, darken } from '../../lib/formatters';
import { ChartPanel } from '../telemetry/ChartPanel';
import { useChartSync } from '../../hooks/useChartSync';
import { useTrackMapUpdate } from '../../hooks/useTrackMapUpdate';
import { buildZoomPlugin, buildClickHandler } from '../../lib/syncChartConfig';
import type { HoverRef, ZoomRef } from '../../lib/syncChartConfig';
import type { LapDataset } from '../../lib/buildChartData';
import type { TrackMapHandle } from '../trackmap';

// ── Corner / position definitions ────────────────────────────────────────────

const CORNERS = [
  { id: 'LF', label: 'Left Front',  keys: ['LFtempL', 'LFtempM', 'LFtempR'] },
  { id: 'RF', label: 'Right Front', keys: ['RFtempR', 'RFtempM', 'RFtempL'] },
  { id: 'LR', label: 'Left Rear',   keys: ['LRtempL', 'LRtempM', 'LRtempR'] },
  { id: 'RR', label: 'Right Rear',  keys: ['RRtempR', 'RRtempM', 'RRtempL'] },
] as const;

// Outer / Mid / Inner — left tires: tempL=outer, tempR=inner; right tires: tempR=outer, tempL=inner.
const POS_LABELS = ['Outer', 'Mid', 'Inner'] as const;

// 0 = full colour, higher = darker (mixed toward black)
const POS_DARKEN = [0, 0.45, 0.68] as const;


// ── Chart options factory ─────────────────────────────────────────────────────

function createTireTempOptions(args: {
  id: string;
  hoverRef: HoverRef;
  zoomRef: ZoomRef;
  yMin: number;
  yMax: number;
}): ChartOptions<'line'> {
  const { id, hoverRef, zoomRef, yMin, yMax } = args;
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
        enabled: true,
        backgroundColor: 'rgba(9, 9, 11, 0.92)',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: { x: 8, y: 5 },
        displayColors: false,
        titleFont: { size: 0 },
        bodyFont: { family: 'monospace', size: 11, weight: 'bold' },
        callbacks: {
          title: () => '',
          label(item) {
            const val = item.raw as { y: number };
            return `${item.dataset.label}: ${val.y.toFixed(1)} °C`;
          },
          labelTextColor: (item) => item.dataset.borderColor as string,
        },
      },
      zoom: buildZoomPlugin(id, zoomRef),
    },

    scales: {
      x: {
        type: 'linear',
        display: true,
        min: 0,
        ticks: {
          color: '#52525b',
          font: { size: 8 },
          maxTicksLimit: 10,
          padding: 1,
          callback: (value) => `${value}m`,
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
      y: {
        min: yMin,
        max: yMax,
        ticks: {
          color: '#52525b',
          font: { size: 8 },
          maxTicksLimit: 5,
          padding: 2,
          callback: (value) => `${value}°`,
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
    },

    onClick: buildClickHandler(id, hoverRef),
  };
}

// ── TireTempView ──────────────────────────────────────────────────────────────

interface Props {
  trackMapRef: RefObject<TrackMapHandle | null>;
}

export function TireTempView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const [yMin, setYMin] = useState(20);
  const [yMax, setYMax] = useState(140);
  const [visibleCorners, setVisibleCorners] = useState<Set<string>>(
    () => new Set(CORNERS.map((c) => c.id)),
  );

  const toggleCorner = useCallback((id: string) => {
    setVisibleCorners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const TEMP_STEPS = Array.from({ length: 13 }, (_, i) => 20 + i * 10); // 20..140

  const onMapUpdate = useTrackMapUpdate(trackMapRef);

  const { register, unregister, handleHover, handleZoom, handleReset, updateLimits } =
    useChartSync(onMapUpdate);

  const hoverRef = useRef<typeof handleHover | null>(null);
  const zoomRef  = useRef<typeof handleZoom  | null>(null);
  hoverRef.current = handleHover;
  zoomRef.current  = handleZoom;

  // Options recreated when Y range changes; hover/zoom callbacks stay stable via refs
  const chartOptions = useMemo(
    () => CORNERS.map((c) => createTireTempOptions({ id: c.id, hoverRef, zoomRef, yMin, yMax })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yMin, yMax],
  );

  // ── Dataset building ──────────────────────────────────────────────────────
  const { cornerDatasets, maxDist } = useMemo(() => {
    const empty = { cornerDatasets: CORNERS.map(() => [] as LapDataset[]), maxDist: 0 };
    if (sessions.length === 0 || Object.keys(selections).length === 0) return empty;

    const multiSession = sessions.length > 1;

    // Collect + sort selected laps by render order
    const sorted = (Object.entries(selections) as [string, typeof COLOR_ORDER[number]][])
      .map(([key, color]) => {
        const colon      = key.indexOf(':');
        const sessionIdx = parseInt(key.substring(0, colon));
        const lapIdx     = parseInt(key.substring(colon + 1));
        const sess = sessions[sessionIdx];
        if (!sess) return null;
        const lap = sess.laps[lapIdx];
        if (!lap) return null;
        return { color, sessionIdx, lapNum: lap.lap, lap, sess };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));

    // X-axis upper bound
    const usedSIs = new Set(sorted.map((e) => e.sessionIdx));
    let maxDistVal = 0;
    for (const si of usedSIs) {
      const arr = sessions[si]?.data['LapDist'] ?? new Float32Array();
      if (arr.length > 0) maxDistVal = Math.max(maxDistVal, arrayMax(arr));
    }

    const resolution = Math.ceil(maxDistVal);
    const axis = Array.from({ length: resolution }, (_, i) => (maxDistVal / resolution) * i);

    const cornerDatasets = CORNERS.map(({ keys }) => {
      const datasets: LapDataset[] = [];
      for (const { color, sessionIdx, lapNum, lap, sess } of sorted) {
        const dist     = (sess.data['LapDist'] ?? new Float32Array()).slice(lap.start_idx, lap.end_idx + 1);
        const lapLabel = multiSession ? `S${sessionIdx + 1}·L${lapNum}` : `L${lapNum}`;

        keys.forEach((key, pi) => {
          const raw = (sess.data[key] ?? new Float32Array()).slice(lap.start_idx, lap.end_idx + 1);
          datasets.push({
            borderColor: darken(getLapColor(color), POS_DARKEN[pi]),
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0,
            normalized: true,
            label: `${lapLabel} ${POS_LABELS[pi]}`,
            data: axis.map((x) => ({ x: Math.round(x), y: interpolate(dist, raw, x) })),
          });
        });
      }
      return datasets;
    });

    return { cornerDatasets, maxDist: maxDistVal };
  }, [sessions, selections]);

  useEffect(() => {
    if (maxDist > 0) updateLimits(maxDist);
  }, [maxDist, updateLimits]);

  const handleDblClick = useCallback(() => {
    if (maxDist > 0) handleReset(maxDist);
  }, [maxDist, handleReset]);

  const registerChart   = useCallback((id: string, inst: Chart) => register(id, inst), [register]);
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

  // ── Empty / no-data states ────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted select-none">
        <ArrowUpTrayIcon className="w-10 h-10 opacity-40" />
        <p className="text-xs tracking-wider uppercase">Open an IBT file to begin</p>
      </div>
    );
  }

  const hasTempData = (sessions[0]?.data['LFtempL']?.length ?? 0) > 0;
  if (!hasTempData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No tire temperature data found in this IBT file.
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2 min-h-0">

      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Tire Temperatures
          </span>
          <span className="text-[10px] text-muted">· °C</span>
        </div>

        {/* Y-axis range selectors */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted uppercase tracking-wider">Y</span>
          <select
            value={yMin}
            onChange={(e) => setYMin(Number(e.target.value))}
            className="px-1.5 py-0.5 text-[10px] bg-surface-2 border border-border rounded text-text focus:outline-none focus:border-accent cursor-pointer"
          >
            {TEMP_STEPS.map((v) => <option key={v} value={v}>{v}°</option>)}
          </select>
          <span className="text-[10px] text-muted">–</span>
          <select
            value={yMax}
            onChange={(e) => setYMax(Number(e.target.value))}
            className="px-1.5 py-0.5 text-[10px] bg-surface-2 border border-border rounded text-text focus:outline-none focus:border-accent cursor-pointer"
          >
            {TEMP_STEPS.map((v) => <option key={v} value={v}>{v}°</option>)}
          </select>
          <span className="text-[10px] text-muted">°C</span>
        </div>

        {/* Corner toggles */}
        <div className="flex items-center gap-1.5 ml-auto">
          {CORNERS.map((c) => {
            const active = visibleCorners.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCorner(c.id)}
                className={[
                  'px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors',
                  active
                    ? 'border-border bg-surface-2 text-text'
                    : 'border-border/30 text-muted/40',
                ].join(' ')}
              >
                {c.id}
              </button>
            );
          })}
        </div>

        {/* Brightness legend */}
        <div className="flex items-center gap-4">
          {POS_LABELS.map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-1.5">
              <svg width="22" height="8" viewBox="0 0 22 8">
                <line x1="1" y1="4" x2="21" y2="4" stroke={darken('#71717a', POS_DARKEN[i])} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] text-muted uppercase tracking-wider">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts or empty-selection state */}
      {Object.keys(selections).length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
          Select laps from the sidebar to compare
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${Math.ceil(visibleCorners.size / 2)}, 1fr)` }}>
          {CORNERS.map((corner, i) => visibleCorners.has(corner.id) && (
            <ChartPanel
              key={corner.id}
              id={corner.id}
              label={corner.label}
              datasets={cornerDatasets[i]}
              options={chartOptions[i]}
              flex={1}
              onRegister={registerChart}
              onUnregister={unregisterChart}
              onDblClick={handleDblClick}
              onWheelPan={handleZoom}
            />
          ))}
        </div>
      )}

    </div>
  );
}
