import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions, Chart } from 'chart.js';
import type { ParsedSession, LapSelections } from '../../types/session';
import { buildChartData } from '../../lib/buildChartData';

export interface DrivingTracesHandle {
  setXRange:   (min: number, max: number) => void;
  resetXRange: () => void;
  syncHover:   (dist: number) => void;
  moveCursor:  (dist: number) => void;
}

interface Props {
  sessions:      ParsedSession[];
  selections:    LapSelections;
  onDistHover?:  (dist: number) => void;
  onZoom?:       () => void;
}

const CHANNELS = [
  { key: 'spd'  as const, label: 'Speed',    flex: 3 },
  { key: 'thr'  as const, label: 'Throttle', flex: 2 },
  { key: 'brk'  as const, label: 'Brake',    flex: 2 },
  { key: 'gear' as const, label: 'Gear',     flex: 2 },
  { key: 'rpm'  as const, label: 'RPM',      flex: 2 },
  { key: 'str'  as const, label: 'Steering', flex: 2 },
];

function formatValue(key: string, y: number): string {
  if (key === 'thr' || key === 'brk') return `${Math.round(y)} %`;
  if (key === 'spd')  return `${Math.round(y)} km/h`;
  if (key === 'gear') return `${Math.round(y)}`;
  if (key === 'rpm')  return `${Math.round(y)} rpm`;
  if (key === 'str')  return `${y.toFixed(1)}°`;
  return y.toFixed(1);
}

function makeBaseOptions(maxDist: number): ChartOptions<'line'> {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    normalized: true,
    events: ['click' as const],
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend:     { display: false },
      decimation: { enabled: true, algorithm: 'lttb', threshold: 2000 },
      tooltip:    { enabled: false }, // DOM tooltip handles this
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: Math.ceil(maxDist),
        display: true,
        ticks: {
          color: 'rgba(161,161,170,0.5)',
          font: { size: 8, family: 'monospace' },
          maxTicksLimit: 6,
          callback: (v) => `${Math.round(Number(v) / 1000 * 10) / 10} km`,
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
      y: {
        type: 'linear',
        display: true,
        ticks: {
          color: 'rgba(161,161,170,0.5)',
          font: { size: 8, family: 'monospace' },
          maxTicksLimit: 4,
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        afterFit(scale) { scale.width = 38; },
      },
    },
  };
}

export const DrivingTraces = forwardRef<DrivingTracesHandle, Props>(
  ({ sessions, selections, onDistHover, onZoom }, ref) => {
    const { datasets, maxDist } = useMemo(
      () => buildChartData(sessions, selections),
      [sessions, selections],
    );

    const onDistHoverRef = useRef(onDistHover);
    onDistHoverRef.current = onDistHover;

    const onZoomRef = useRef(onZoom);
    onZoomRef.current = onZoom;

    const maxDistRef   = useRef(maxDist);
    maxDistRef.current = maxDist;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRefs   = useRef<Record<string, Chart<'line'> | null>>({});
    const cleanupRefs = useRef<Record<string, (() => void) | undefined>>({});
    const tooltipRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const cursorLineRef = useRef<HTMLDivElement>(null);

    // ── Stable X-range sync ───────────────────────────────────────────────────
    const applyXRange = useCallback((min: number, max: number) => {
      for (const chart of Object.values(chartRefs.current)) {
        if (!chart) continue;
        const xs = chart.options.scales?.x;
        if (xs) { xs.min = min; xs.max = max; chart.update('none'); }
      }
    }, []);

    const applyXRangeRef = useRef(applyXRange);
    applyXRangeRef.current = applyXRange;

    // ── Chart options ─────────────────────────────────────────────────────────
    const channelOptions = useMemo(() => {
      const zoomPlugin = {
        limits: { x: { min: 0, max: maxDist, minRange: 100 } },
        zoom: {
          wheel:  { enabled: false },
          pinch:  { enabled: true },
          drag:   { enabled: true, modifierKey: 'ctrl' as const },
          mode:   'x' as const,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onZoom: ({ chart }: { chart: any }) => {
            const xs = chart.scales['x'];
            if (xs) applyXRangeRef.current(xs.min, xs.max);
            onZoomRef.current?.();
          },
        },
        pan: { enabled: false, mode: 'x' as const },
      };
      return Object.fromEntries(
        CHANNELS.map(({ key }) => {
          const base = makeBaseOptions(maxDist);
          return [key, { ...base, plugins: { ...base.plugins, zoom: zoomPlugin } }];
        }),
      );
    }, [maxDist]);

    // ── DOM tooltip update — per-dataset binary search avoids index mismatch ───
    const updateTooltip = useCallback((
      key: string,
      chart: Chart<'line'>,
      lapDist: number,
    ) => {
      const el = tooltipRefs.current[key];
      if (!el) return;

      const xScale = chart.scales['x'];
      if (!xScale || lapDist < xScale.min || lapDist > xScale.max) {
        el.style.display = 'none';
        return;
      }

      const px = xScale.getPixelForValue(lapDist);
      const { top } = chart.chartArea;

      let html = '';
      for (const dataset of chart.data.datasets) {
        if ((dataset.label as string)?.endsWith(' ABS')) continue;
        const data = dataset.data as { x: number; y: number }[];
        if (!data.length) continue;

        // Binary search per-dataset so different-length arrays stay in sync
        let lo = 0, hi = data.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if ((data[m] as { x: number }).x < lapDist) lo = m + 1; else hi = m;
        }

        const curr = data[lo];
        const prev = data[Math.max(0, lo - 1)];
        if (!curr) continue;

        const frac = (prev && curr.x !== prev.x)
          ? Math.max(0, Math.min(1, (lapDist - prev.x) / (curr.x - prev.x)))
          : 1;
        const y = prev ? prev.y + (curr.y - prev.y) * frac : curr.y;

        const color = dataset.borderColor as string;
        html += `<span style="color:${color}">${formatValue(key, y)}</span> `;
      }

      el.innerHTML  = html.trim();
      el.style.left = `${px}px`;
      el.style.top  = `${top + 6}px`;
      el.style.display = 'block';
    }, []);

    // ── Cross-chart sync — CSS cursor line + DOM tooltips, zero chart.draw() ──
    const syncAllCharts = useCallback((lapDist: number) => {
      const anyChart = Object.values(chartRefs.current).find(Boolean);
      const cl = cursorLineRef.current;
      if (anyChart && cl) {
        const xs = anyChart.scales['x'];
        if (xs && lapDist >= xs.min && lapDist <= xs.max) {
          cl.style.left    = `${xs.getPixelForValue(lapDist)}px`;
          cl.style.display = 'block';
        } else {
          cl.style.display = 'none';
        }
      }
      for (const [key, chart] of Object.entries(chartRefs.current)) {
        if (!chart) continue;
        updateTooltip(key, chart, lapDist);
      }
    }, [updateTooltip]);

    useImperativeHandle(ref, () => ({
      setXRange:   (min, max) => applyXRange(min, max),
      resetXRange: ()         => applyXRange(0, maxDistRef.current),
      syncHover: (dist: number) => {
        syncAllCharts(dist);
      },
      moveCursor: (dist: number) => {
        const el = cursorLineRef.current;
        if (!el) return;
        const chart = Object.values(chartRefs.current).find(Boolean);
        if (!chart) return;
        const xs = chart.scales['x'];
        if (!xs || dist < xs.min || dist > xs.max) { el.style.display = 'none'; return; }
        el.style.left    = `${xs.getPixelForValue(dist)}px`;
        el.style.display = 'block';
      },
    }), [applyXRange, syncAllCharts]);

    // ── Per-chart mouse/wheel listeners ───────────────────────────────────────
    const registerChart = useCallback((key: string, chart: Chart<'line'> | null) => {
      cleanupRefs.current[key]?.();
      cleanupRefs.current[key] = undefined;

      if (!chart) {
        delete chartRefs.current[key];
        tooltipRefs.current[key] = null;
        return;
      }
      chartRefs.current[key] = chart;

      const canvas = chart.canvas;
      let dragging = false;
      let rafId: number | null = null;
      let lastEvent: MouseEvent | null = null;

      const doSync = (e: MouseEvent) => {
        const xScale = chart.scales['x'];
        if (!xScale) return;
        const rect    = chart.canvas.getBoundingClientRect();
        const lapDist = xScale.getValueForPixel(e.clientX - rect.left);
        if (lapDist == null || lapDist < xScale.min || lapDist > xScale.max) return;
        onDistHoverRef.current?.(lapDist);
        syncAllCharts(lapDist);
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        dragging = true;
        doSync(e);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        lastEvent = e;
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (dragging && lastEvent) doSync(lastEvent);
        });
      };

      const onMouseUp  = () => { dragging = false; };
      const onLeave    = () => {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chart as any).pan({ x: -delta });
        const xs = chart.scales['x'];
        if (xs) applyXRangeRef.current(xs.min, xs.max);
        onZoomRef.current?.();
      };

      canvas.addEventListener('mousedown',  onMouseDown);
      canvas.addEventListener('mousemove',  onMouseMove);
      canvas.addEventListener('mouseleave', onLeave);
      canvas.addEventListener('wheel',      onWheel, { passive: false });
      window.addEventListener('mouseup',    onMouseUp);

      cleanupRefs.current[key] = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousedown',  onMouseDown);
        canvas.removeEventListener('mousemove',  onMouseMove);
        canvas.removeEventListener('mouseleave', onLeave);
        canvas.removeEventListener('wheel',      onWheel);
        window.removeEventListener('mouseup',    onMouseUp);
      };
    }, [syncAllCharts]);

    if (Object.keys(selections).length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
          Select laps from the sidebar
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 gap-px bg-border relative">
        {/* Playback CSS cursor line */}
        <div
          ref={cursorLineRef}
          className="absolute top-0 bottom-0 w-px pointer-events-none z-20"
          style={{ display: 'none', left: 0, backgroundColor: 'rgba(255,255,255,0.35)' }}
        />

        {CHANNELS.map(({ key, label, flex }) => {
          const ds = datasets[key];
          if (!ds?.length) return null;
          return (
            <div
              key={key}
              className="relative bg-surface min-h-0 overflow-hidden"
              style={{ flex }}
            >
              <span className="absolute bottom-4 right-2 z-10 text-[9px] font-bold text-muted uppercase tracking-wider pointer-events-none select-none">
                {label}
              </span>

              <div className="absolute inset-0">
                <Line
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ref={(c: any) => registerChart(key, c)}
                  data={{ datasets: ds }}
                  options={channelOptions[key]}
                />
              </div>

              {/* DOM tooltip — interpolated, no canvas redraw needed */}
              <div
                ref={(el) => { tooltipRefs.current[key] = el; }}
                className="absolute z-30 pointer-events-none select-none"
                style={{
                  display: 'none',
                  transform: 'translateX(-50%)',
                  background: 'rgba(9,9,11,0.92)',
                  border: '1px solid #27272a',
                  borderRadius: 3,
                  padding: '2px 7px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  gap: 6,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  },
);

DrivingTraces.displayName = 'DrivingTraces';
