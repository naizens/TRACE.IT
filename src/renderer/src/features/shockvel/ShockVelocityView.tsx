import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions, Chart } from 'chart.js';
import { useStore } from '../../store/useStore';
import { LAP_COLORS, COLOR_ORDER } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { arrayMax, darken } from '../../lib/formatters';
import { useChartSync } from '../../hooks/useChartSync';
import { useTrackMapUpdate } from '../../hooks/useTrackMapUpdate';
import { buildZoomPlugin, buildClickHandler, type HoverRef, type ZoomRef } from '../../lib/syncChartConfig';
import type { TrackMapHandle } from '../trackmap';

// ── Constants ─────────────────────────────────────────────────────────────────

const CH = {
  lapDist: 'LapDist',
  lf: 'LFshockVel',
  rf: 'RFshockVel',
  lr: 'LRshockVel',
  rr: 'RRshockVel',
} as const;

// ── Options factory ───────────────────────────────────────────────────────────

function createShockVelOptions(
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
            `${(item.dataset.label as string).split(' ').pop()}: ${(item.parsed.y as number).toFixed(3)} m/s`,
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
        title: { display: true, text: 'm/s', color: '#52525b', font: { size: 10 } },
        ticks: { color: '#52525b', font: { size: 9 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
    },
    onClick: buildClickHandler(id, hoverRef),
  };
}

// ── Data builder ──────────────────────────────────────────────────────────────

interface ShockVelChartData {
  front: ChartData<'line'>;
  rear:  ChartData<'line'>;
  maxDist: number;
}

function buildShockVelData(
  sessions: ReturnType<typeof useStore.getState>['sessions'],
  selections: ReturnType<typeof useStore.getState>['selections'],
): ShockVelChartData | null {
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
    const hex   = LAP_COLORS[color];
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
      axis.map((x) => ({ x: Math.round(x), y: interpolate(dist, arr, x) }));

    const baseStyle = {
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
      normalized: true,
    } as const;

    frontDatasets.push({
      ...baseStyle,
      label: `${label} LF`,
      borderColor: hex,
      data: resample(lf),
    });
    frontDatasets.push({
      ...baseStyle,
      label: `${label} RF`,
      borderColor: darken(hex, 0.45),
      data: resample(rf),
    });

    rearDatasets.push({
      ...baseStyle,
      label: `${label} LR`,
      borderColor: hex,
      data: resample(lr),
    });
    rearDatasets.push({
      ...baseStyle,
      label: `${label} RR`,
      borderColor: darken(hex, 0.45),
      data: resample(rr),
    });
  }

  return {
    front: { datasets: frontDatasets },
    rear:  { datasets: rearDatasets },
    maxDist,
  };
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ShockVelPanelProps {
  id: string;
  label: string;
  legend?: string;
  chartData: ChartData<'line'>;
  options: ChartOptions<'line'>;
  onRegister:   (id: string, chart: Chart) => void;
  onUnregister: (id: string) => void;
  onWheelPan:   (id: string, min: number, max: number) => void;
  onDblClick:   () => void;
}

function ShockVelPanel({
  id, label, legend, chartData, options,
  onRegister, onUnregister, onWheelPan, onDblClick,
}: ShockVelPanelProps) {
  const onWheelPanRef = useRef(onWheelPan);
  onWheelPanRef.current = onWheelPan;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

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

// ── ShockVelocityView ─────────────────────────────────────────────────────────

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

export function ShockVelocityView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);

  const onMapUpdate = useTrackMapUpdate(trackMapRef);

  const { register, unregister, handleZoom, handleHover, handleReset, updateLimits } =
    useChartSync(onMapUpdate);

  const zoomRef  = useRef<typeof handleZoom  | null>(null);
  const hoverRef = useRef<typeof handleHover | null>(null);
  zoomRef.current  = handleZoom;
  hoverRef.current = handleHover;

  const chartOptions = useMemo(
    () => ({
      front: createShockVelOptions('shockvel-front', zoomRef, hoverRef),
      rear:  createShockVelOptions('shockvel-rear',  zoomRef, hoverRef),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const data = useMemo(
    () => buildShockVelData(sessions, selections),
    [sessions, selections],
  );

  useEffect(() => {
    if (data) updateLimits(data.maxDist);
  }, [data?.maxDist, updateLimits]);

  const handleDblClick = useCallback(() => {
    if (data) handleReset(data.maxDist);
  }, [data, handleReset]);

  const registerChart   = useCallback((id: string, c: Chart) => register(id, c),  [register]);
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

  // Panel resize
  const [flexValues, setFlexValues] = useState([1, 1]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback(
    (i: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      const startY    = e.clientY;
      const startFlex = [...flexValues];
      const totalFlex = startFlex.reduce((a, b) => a + b, 0);

      const onMouseMove = (ev: MouseEvent) => {
        const dy          = ev.clientY - startY;
        const totalHeight = containerRef.current?.clientHeight ?? 400;
        const dyFlex      = (dy / totalHeight) * totalFlex;
        const next = [...startFlex];
        next[i]     = Math.max(0.25, startFlex[i]     + dyFlex);
        next[i + 1] = Math.max(0.25, startFlex[i + 1] - dyFlex);
        setFlexValues(next);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup',   onMouseUp);
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor     = 'ns-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup',   onMouseUp);
    },
    [flexValues],
  );

  const resetFlex = useCallback(() => setFlexValues([1, 1]), []);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        Open an IBT file to view shock velocity.
      </div>
    );
  }

  const hasData = (sessions[0]?.data[CH.lf]?.length ?? 0) > 0;
  if (!hasData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No shock velocity data found in this IBT file.
      </div>
    );
  }

  const empty: ChartData<'line'> = { datasets: [] };

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Shock Velocity
        </span>
        <span className="text-[10px] text-muted">· m/s · over lap distance</span>
        <div className="flex items-center gap-3 ml-auto text-[9px] text-muted">
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Left
          </span>
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" />
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
        <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
          <div style={{ flex: flexValues[0] }} className="relative flex flex-col min-h-0">
            <ShockVelPanel
              id="shockvel-front"
              label="Front"
              legend="bright = LF · dark = RF"
              chartData={data?.front ?? empty}
              options={chartOptions.front}
              onRegister={registerChart}
              onUnregister={unregisterChart}
              onWheelPan={handleZoom}
              onDblClick={handleDblClick}
            />
            <div
              className="absolute bottom-0 inset-x-0 h-4 translate-y-1/2 z-10 cursor-ns-resize group"
              onMouseDown={handleResizeStart(0)}
              onDoubleClick={resetFlex}
            >
              <div className="absolute inset-x-0 top-1/2 h-px bg-border pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-2 rounded-full bg-surface-2 border border-border group-hover:border-accent/50 transition-colors pointer-events-none" />
            </div>
          </div>
          <div style={{ flex: flexValues[1] }} className="flex flex-col min-h-0">
            <ShockVelPanel
              id="shockvel-rear"
              label="Rear"
              legend="bright = LR · dark = RR"
              chartData={data?.rear ?? empty}
              options={chartOptions.rear}
              onRegister={registerChart}
              onUnregister={unregisterChart}
              onWheelPan={handleZoom}
              onDblClick={handleDblClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}
