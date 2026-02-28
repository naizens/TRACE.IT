import { useRef, useMemo, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { ChartOptions } from 'chart.js';
import type { Chart } from 'chart.js';
import { useStore } from '../../store/useStore';
import { LAP_COLORS, COLOR_ORDER } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { arrayMax } from '../../lib/formatters';
import { ChartPanel } from '../telemetry/ChartPanel';
import { useChartSync } from '../../hooks/useChartSync';
import { buildZoomPlugin, buildHoverHandler } from '../../lib/syncChartConfig';
import type { HoverRef, ZoomRef } from '../../lib/syncChartConfig';
import type { LapDataset } from '../telemetry/utils/buildChartData';
import type { TrackMapHandle } from '../trackmap/TrackMap';

// ── Corner / position definitions ────────────────────────────────────────────

const CORNERS = [
  { id: 'LF', label: 'Left Front',  keys: ['LFtempL', 'LFtempM', 'LFtempR'] },
  { id: 'RF', label: 'Right Front', keys: ['RFtempL', 'RFtempM', 'RFtempR'] },
  { id: 'LR', label: 'Left Rear',   keys: ['LRtempL', 'LRtempM', 'LRtempR'] },
  { id: 'RR', label: 'Right Rear',  keys: ['RRtempL', 'RRtempM', 'RRtempR'] },
] as const;

// Outer / Mid / Inner — CL is the outboard edge for left tires, inboard for right tires.
// Labels are intentionally position-agnostic so both sides read consistently.
const POS_LABELS = ['Outer', 'Mid', 'Inner'] as const;

// Solid / long-dash / dotted — visually distinct at small sizes
const POS_DASHES: number[][] = [[], [6, 3], [2, 3]];

// ── Chart options factory ─────────────────────────────────────────────────────

function createTireTempOptions(args: {
  id: string;
  hoverRef: HoverRef;
  zoomRef: ZoomRef;
}): ChartOptions<'line'> {
  const { id, hoverRef, zoomRef } = args;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
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
        min: 40,
        max: 130,
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

    onHover: buildHoverHandler(id, hoverRef),
  };
}

// ── TireTempView ──────────────────────────────────────────────────────────────

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

export function TireTempView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const onMapUpdate = useCallback((lapDist: number) => {
    trackMapRef.current?.updateMarker(lapDist);
  }, [trackMapRef]);

  const { register, unregister, handleHover, handleZoom, handleReset, updateLimits } =
    useChartSync(onMapUpdate);

  const hoverRef = useRef<typeof handleHover | null>(null);
  const zoomRef  = useRef<typeof handleZoom  | null>(null);
  hoverRef.current = handleHover;
  zoomRef.current  = handleZoom;

  // Options created once per corner (stable, callbacks go through refs)
  const chartOptions = useMemo(
    () => CORNERS.map((c) => createTireTempOptions({ id: c.id, hoverRef, zoomRef })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
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
      const arr = sessions[si]?.data['LapDist'] ?? [];
      if (arr.length > 0) maxDistVal = Math.max(maxDistVal, arrayMax(arr));
    }

    const resolution = Math.ceil(maxDistVal);
    const axis = Array.from({ length: resolution }, (_, i) => (maxDistVal / resolution) * i);

    const cornerDatasets = CORNERS.map(({ keys }) => {
      const datasets: LapDataset[] = [];
      for (const { color, sessionIdx, lapNum, lap, sess } of sorted) {
        const dist     = (sess.data['LapDist'] ?? []).slice(lap.start_idx, lap.end_idx + 1);
        const lapLabel = multiSession ? `S${sessionIdx + 1}·L${lapNum}` : `L${lapNum}`;

        keys.forEach((key, pi) => {
          const raw = (sess.data[key] ?? []).slice(lap.start_idx, lap.end_idx + 1);
          datasets.push({
            borderColor: LAP_COLORS[color],
            borderWidth: 1,
            pointRadius: 0,
            tension: 0,
            normalized: true,
            label: `${lapLabel} ${POS_LABELS[pi]}`,
            borderDash: POS_DASHES[pi],
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
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
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

        {/* Dash-pattern legend */}
        <div className="flex items-center gap-4 ml-auto">
          {POS_LABELS.map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-1.5">
              <svg width="22" height="8" viewBox="0 0 22 8" overflow="visible">
                <line
                  x1="1" y1="4" x2="21" y2="4"
                  stroke="#71717a"
                  strokeWidth="1.5"
                  strokeDasharray={POS_DASHES[i].join(' ')}
                  strokeLinecap="round"
                />
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
        <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
          {CORNERS.map((corner, i) => (
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
