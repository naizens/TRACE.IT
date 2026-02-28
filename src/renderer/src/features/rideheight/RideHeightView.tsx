import { useMemo, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { useStore } from '../../store/useStore';
import { LAP_COLORS, COLOR_ORDER } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { arrayMax } from '../../lib/formatters';
import { useChartSync } from '../../hooks/useChartSync';
import { buildZoomPlugin, buildHoverHandler, type HoverRef, type ZoomRef } from '../../lib/syncChartConfig';
import type { TrackMapHandle } from '../trackmap/TrackMap';

// ── Constants ─────────────────────────────────────────────────────────────────

const MM = 1000; // m → mm

// iRacing channel names
const CH = {
  lapDist: 'LapDist',
  lf: 'LFrideHeight',
  rf: 'RFrideHeight',
  lr: 'LRrideHeight',
  rr: 'RRrideHeight',
} as const;

// ── Options factory ───────────────────────────────────────────────────────────

function createRideOptions(
  id: string,
  zoomRef: ZoomRef,
  hoverRef: HoverRef,
): ChartOptions<'line'> {
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
    onHover: buildHoverHandler(id, hoverRef),
  };
}

// ── Data builder ──────────────────────────────────────────────────────────────

interface RideChartData {
  splitter: ChartData<'line'>;
  front:    ChartData<'line'>;
  rear:     ChartData<'line'>;
  maxDist:  number;
}

function buildRideData(
  sessions: ReturnType<typeof useStore.getState>['sessions'],
  selections: ReturnType<typeof useStore.getState>['selections'],
): RideChartData | null {
  if (sessions.length === 0 || Object.keys(selections).length === 0) return null;

  const multiSession = sessions.length > 1;

  // x-axis: max LapDist across selected sessions
  const usedSessions = new Set(
    Object.keys(selections).map((k) => parseInt(k.split(':')[0])),
  );
  let maxDist = 0;
  for (const si of usedSessions) {
    const arr = sessions[si]?.data[CH.lapDist] ?? [];
    if (arr.length > 0) maxDist = Math.max(maxDist, arrayMax(arr));
  }
  if (maxDist === 0) return null;

  const resolution = Math.ceil(maxDist);
  const axis = Array.from({ length: resolution }, (_, i) => (maxDist / resolution) * i);

  const splitterDatasets: ChartData<'line'>['datasets'] = [];
  const frontDatasets:    ChartData<'line'>['datasets'] = [];
  const rearDatasets:     ChartData<'line'>['datasets'] = [];

  // Sort by COLOR_ORDER so ref is always drawn last (on top)
  const entries = Object.entries(selections);
  const sorted = entries
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
    const hex   = LAP_COLORS[color];
    const label = multiSession ? `S${sessionIdx + 1}·L${lapNum}` : `L${lapNum}`;

    const s = lap.start_idx;
    const e = lap.end_idx + 1;
    const d = sess.data;

    const dist = (d[CH.lapDist] ?? []).slice(s, e);
    const lf   = (d[CH.lf]      ?? []).slice(s, e);
    const rf   = (d[CH.rf]      ?? []).slice(s, e);
    const lr   = (d[CH.lr]      ?? []).slice(s, e);
    const rr   = (d[CH.rr]      ?? []).slice(s, e);

    const resample = (arr: number[]) =>
      axis.map((x) => ({ x: Math.round(x), y: interpolate(dist, arr, x) * MM }));

    const baseStyle = {
      borderWidth: 1,
      pointRadius: 0,
      tension: 0,
      normalized: true,
    } as const;

    // Splitter = average of LF + RF
    const splitterRaw = lf.map((v, i) => (v + (rf[i] ?? 0)) / 2);
    splitterDatasets.push({
      ...baseStyle,
      label,
      borderColor: hex,
      data: resample(splitterRaw),
    });

    // Front: LF solid, RF dashed
    frontDatasets.push({
      ...baseStyle,
      label: `${label} LF`,
      borderColor: hex,
      data: resample(lf),
    });
    frontDatasets.push({
      ...baseStyle,
      label: `${label} RF`,
      borderColor: hex,
      borderDash: [4, 3],
      borderWidth: 1,
      data: resample(rf),
    });

    // Rear: LR solid, RR dashed
    rearDatasets.push({
      ...baseStyle,
      label: `${label} LR`,
      borderColor: hex,
      data: resample(lr),
    });
    rearDatasets.push({
      ...baseStyle,
      label: `${label} RR`,
      borderColor: hex,
      borderDash: [4, 3],
      borderWidth: 1,
      data: resample(rr),
    });
  }

  return {
    splitter: { datasets: splitterDatasets },
    front:    { datasets: frontDatasets },
    rear:     { datasets: rearDatasets },
    maxDist,
  };
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface RidePanelProps {
  id: string;
  label: string;
  legend?: string;
  chartData: ChartData<'line'>;
  options: ChartOptions<'line'>;
  onRegister:   (id: string, chart: import('chart.js').Chart) => void;
  onUnregister: (id: string) => void;
  onWheelPan:   (id: string, min: number, max: number) => void;
  onDblClick:   () => void;
}

function RidePanel({
  id, label, legend, chartData, options,
  onRegister, onUnregister, onWheelPan, onDblClick,
}: RidePanelProps) {
  const onWheelPanRef = useRef(onWheelPan);
  onWheelPanRef.current = onWheelPan;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  // Register with sync, attach wheel pan handler
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    onRegister(id, chart);

    const canvas = chart.canvas;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      chart.pan({ x: -delta });
      const x = chart.scales['x'];
      if (x) onWheelPanRef.current(id, x.min, x.max);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      onUnregister(id);
      canvas.removeEventListener('wheel', handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Double-click resets zoom on all charts
  useEffect(() => {
    const canvas = chartRef.current?.canvas;
    if (!canvas) return;
    canvas.addEventListener('dblclick', onDblClick);
    return () => canvas.removeEventListener('dblclick', onDblClick);
  }, [onDblClick]);

  return (
    <div className="flex flex-col bg-surface rounded-lg p-3 min-h-0 overflow-hidden flex-1">
      <div className="flex items-baseline gap-2 mb-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        {legend && (
          <span className="text-[9px] text-muted/60">{legend}</span>
        )}
      </div>
      <div className="flex-1 relative min-h-0">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}

// ── RideHeightView ────────────────────────────────────────────────────────────

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

export function RideHeightView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);

  const onMapUpdate = useCallback((lapDist: number) => {
    trackMapRef.current?.updateMarker(lapDist);
  }, [trackMapRef]);

  const { register, unregister, handleZoom, handleHover, handleReset, updateLimits } = useChartSync(onMapUpdate);

  // Stable refs so options closures never go stale
  const zoomRef  = useRef<typeof handleZoom  | null>(null);
  const hoverRef = useRef<typeof handleHover | null>(null);
  zoomRef.current  = handleZoom;
  hoverRef.current = handleHover;

  // Options created once — callbacks read through refs
  const chartOptions = useMemo(
    () => ({
      splitter: createRideOptions('splitter', zoomRef, hoverRef),
      front:    createRideOptions('front',    zoomRef, hoverRef),
      rear:     createRideOptions('rear',     zoomRef, hoverRef),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const data = useMemo(
    () => buildRideData(sessions, selections),
    [sessions, selections],
  );

  // Sync x-axis upper bound whenever data changes
  useEffect(() => {
    if (data) updateLimits(data.maxDist);
  }, [data?.maxDist, updateLimits]);

  const handleDblClick = useCallback(() => {
    if (data) handleReset(data.maxDist);
  }, [data, handleReset]);

  const registerChart  = useCallback((id: string, c: import('chart.js').Chart) => register(id, c), [register]);
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        Open an IBT file to view ride heights.
      </div>
    );
  }

  const hasData = (sessions[0]?.data[CH.lf]?.length ?? 0) > 0;
  if (!hasData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No ride height data found in this IBT file.
      </div>
    );
  }

  const empty: ChartData<'line'> = { datasets: [] };

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Ride Heights
        </span>
        <span className="text-[10px] text-muted">· mm · over lap distance</span>
        <div className="flex items-center gap-3 ml-auto text-[9px] text-muted">
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Left
          </span>
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            Right
          </span>
        </div>
      </div>

      {Object.keys(selections).length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
          Select laps from the sidebar to compare
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <RidePanel
            id="splitter"
            label="Front Splitter"
            legend="avg(LF, RF)"
            chartData={data?.splitter ?? empty}
            options={chartOptions.splitter}
            onRegister={registerChart}
            onUnregister={unregisterChart}
            onWheelPan={handleZoom}
            onDblClick={handleDblClick}
          />
          <RidePanel
            id="front"
            label="Front"
            legend="solid = LF · dashed = RF"
            chartData={data?.front ?? empty}
            options={chartOptions.front}
            onRegister={registerChart}
            onUnregister={unregisterChart}
            onWheelPan={handleZoom}
            onDblClick={handleDblClick}
          />
          <RidePanel
            id="rear"
            label="Rear"
            legend="solid = LR · dashed = RR"
            chartData={data?.rear ?? empty}
            options={chartOptions.rear}
            onRegister={registerChart}
            onUnregister={unregisterChart}
            onWheelPan={handleZoom}
            onDblClick={handleDblClick}
          />
        </div>
      )}
    </div>
  );
}
