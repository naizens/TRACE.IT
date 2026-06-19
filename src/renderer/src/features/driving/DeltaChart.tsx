import { useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import type { Chart, ChartOptions } from 'chart.js';
import type { DeltaData } from '../trackmap';
import { interpolate } from '../../lib/interpolate';

export interface DeltaChartHandle {
  syncHover:  (dist: number) => void;
  clearHover: () => void;
}

interface Props {
  deltaData:    DeltaData;
  maxDist:      number;
  refColor:     string;
  cmpColor:     string;
  sectorRange?: { start: number; end: number } | null;
  onDistHover?: (dist: number) => void;
}

export const DeltaChart = forwardRef<DeltaChartHandle, Props>(
  ({ deltaData, maxDist, refColor, cmpColor, sectorRange, onDistHover }, ref) => {
    const chartRef       = useRef<Chart<'line'> | null>(null);
    const tooltipRef     = useRef<HTMLDivElement>(null);
    const cursorLineRef  = useRef<HTMLDivElement>(null);
    const cleanupRef     = useRef<(() => void) | null>(null);
    const maxDistRef     = useRef(maxDist);
    maxDistRef.current   = maxDist;
    const onDistHoverRef = useRef(onDistHover);
    onDistHoverRef.current = onDistHover;

    // ── Sync a specific dist onto this chart ──────────────────────────────────
    const doSync = useCallback((dist: number) => {
      const chart = chartRef.current;
      if (!chart) return;

      const deltaDs = chart.data.datasets.find((d) => d.label === 'Δ');
      if (!deltaDs) return;
      const data = deltaDs.data as { x: number; y: number }[];
      if (!data.length) return;

      let lo = 0, hi = data.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (data[m].x < dist) lo = m + 1; else hi = m;
      }

      const xScale = chart.scales['x'];
      if (!xScale || dist < xScale.min || dist > xScale.max) {
        if (tooltipRef.current)    tooltipRef.current.style.display    = 'none';
        if (cursorLineRef.current) cursorLineRef.current.style.display = 'none';
        return;
      }

      const px = xScale.getPixelForValue(dist);

      // CSS cursor line — no canvas redraw
      const cl = cursorLineRef.current;
      if (cl) {
        cl.style.left    = `${px}px`;
        cl.style.top     = `${chart.chartArea.top}px`;
        cl.style.height  = `${chart.chartArea.bottom - chart.chartArea.top}px`;
        cl.style.display = 'block';
      }

      // DOM tooltip
      const el = tooltipRef.current;
      if (!el) return;
      const curr = data[lo];
      const prev = data[Math.max(0, lo - 1)];
      const frac = (prev && curr.x !== prev.x)
        ? Math.max(0, Math.min(1, (dist - prev.x) / (curr.x - prev.x)))
        : 1;
      const y = prev ? prev.y + (curr.y - prev.y) * frac : curr.y;

      el.innerHTML     = `<span style="color:${deltaDs.borderColor as string}">${y >= 0 ? '+' : ''}${y.toFixed(3)} s</span>`;
      el.style.left    = `${px}px`;
      el.style.top     = `${chart.chartArea.top + 4}px`;
      el.style.display = 'block';
    }, []);

    useImperativeHandle(ref, () => ({
      syncHover:  doSync,
      clearHover() {
        if (tooltipRef.current)    tooltipRef.current.style.display    = 'none';
        if (cursorLineRef.current) cursorLineRef.current.style.display = 'none';
      },
    }), [doSync]);

    // ── Attach canvas mouse listener once the chart instance is ready ─────────
    const registerChart = useCallback((instance: Chart<'line'> | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      chartRef.current = instance;
      if (!instance) return;

      const canvas = instance.canvas;
      let dragging = false;
      let rafId: number | null = null;

      const fire = (e: MouseEvent) => {
        const xScale = instance.scales['x'];
        if (!xScale) return;
        const rect = canvas.getBoundingClientRect();
        const dist = xScale.getValueForPixel(e.clientX - rect.left);
        if (dist == null || dist < xScale.min || dist > xScale.max) return;
        doSync(dist);
        onDistHoverRef.current?.(dist);
      };

      const onMouseDown = (e: MouseEvent) => { if (e.button === 0) { dragging = true; fire(e); } };
      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => { rafId = null; if (dragging) fire(e); });
      };
      const onMouseUp = () => { dragging = false; };

      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      cleanupRef.current = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, [doSync]);

    const datasets = useMemo(() => {
      const N    = Math.min(Math.ceil(maxDist), 2000);
      const axis = Array.from({ length: N }, (_, i) => (maxDist / N) * i);

      const deltaPoints = axis.map((x) => ({
        x: Math.round(x),
        y: interpolate(deltaData.cmpDist, deltaData.cmpTime, x)
         - interpolate(deltaData.refDist, deltaData.refTime, x),
      }));

      return [
        {
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderDash:  [4, 3],
          pointRadius: 0, pointHoverRadius: 0,
          tension: 0, label: 'Ref',
          data: axis.map((x) => ({ x: Math.round(x), y: 0 })),
        },
        {
          borderColor:     cmpColor,
          backgroundColor: `${cmpColor}30`,
          borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 0,
          tension: 0.3, fill: 'origin', label: 'Δ',
          data: deltaPoints,
        },
      ];
    }, [deltaData, maxDist, refColor, cmpColor]);

    const options = useMemo<ChartOptions<'line'>>(() => ({
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      layout: { padding: 0 },
      events: [],
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend:     { display: false },
        decimation: { enabled: true, algorithm: 'lttb', threshold: 2000 },
        tooltip:    { enabled: false },
      },
      scales: {
        x: { type: 'linear', display: false, min: 0, max: Math.ceil(maxDist) },
        y: { type: 'linear', display: false },
      },
    }), [maxDist]);

    return (
      <div className="absolute inset-0">
        {sectorRange && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{
              left:            `${sectorRange.start * 100}%`,
              width:           `${(sectorRange.end - sectorRange.start) * 100}%`,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderLeft:      '1px solid rgba(255,255,255,0.3)',
              borderRight:     '1px solid rgba(255,255,255,0.3)',
            }}
          />
        )}
        <Line
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={(c: any) => registerChart(c ?? null)}
          data={{ datasets }}
          options={options}
        />
        <div
          ref={cursorLineRef}
          className="absolute w-px pointer-events-none z-20"
          style={{ display: 'none', backgroundColor: 'rgba(255,255,255,0.5)' }}
        />
        <div
          ref={tooltipRef}
          className="absolute z-30 pointer-events-none select-none"
          style={{
            display: 'none', transform: 'translateX(-50%)',
            background: 'rgba(9,9,11,0.92)', border: '1px solid #27272a',
            borderRadius: 3, padding: '2px 7px',
            fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap',
          }}
        />
      </div>
    );
  },
);

DeltaChart.displayName = 'DeltaChart';
