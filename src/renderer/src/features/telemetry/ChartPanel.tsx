import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { LapDataset } from '../../lib/buildChartData';

export interface ChartPanelHandle {
  resetZoom: () => void;
}

interface Props {
  id: string;
  label: string;
  datasets: LapDataset[];
  options: ChartOptions<'line'>;
  flex: number;
  onRegister: (id: string, instance: import('chart.js').Chart) => void;
  onUnregister: (id: string) => void;
  onDblClick: () => void;
  onWheelPan: (id: string, min: number, max: number) => void;
}

export const ChartPanel = forwardRef<ChartPanelHandle, Props>(
  ({ id, label, datasets, options, flex, onRegister, onUnregister, onDblClick, onWheelPan }, ref) => {
    // Keep onWheelPan in a ref so the wheel handler closure never goes stale
    const onWheelPanRef = useRef(onWheelPan);
    onWheelPanRef.current = onWheelPan;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRef = useRef<any>(null);

    // Register chart instance with the sync hook on mount.
    // Wheel events pan the chart left/right; Ctrl+drag zooms (handled by plugin).
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      onRegister(id, chart);

      // Capture canvas now — react-chartjs-2's cleanup will null chart.canvas
      // before our cleanup runs (React Strict Mode simulated unmount).
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

    // Double-click on the canvas resets zoom on all charts
    useEffect(() => {
      const canvas = chartRef.current?.canvas;
      if (!canvas) return;
      canvas.addEventListener('dblclick', onDblClick);
      return () => canvas.removeEventListener('dblclick', onDblClick);
    }, [onDblClick]);

    useImperativeHandle(ref, () => ({
      resetZoom: () => chartRef.current?.resetZoom(),
    }));

    return (
      <div
        className="relative bg-surface border border-border rounded overflow-hidden min-h-0"
        style={{ flex }}
      >
        {/* Channel label */}
        <span className="absolute top-1 left-2 z-10 text-[9px] font-bold text-muted uppercase tracking-wider pointer-events-none select-none">
          {label}
        </span>

        {/* Chart canvas wrapper — must be relative + sized for Chart.js */}
        <div className="chart-container absolute inset-0 pt-4">
          <Line
            ref={chartRef}
            data={{ datasets }}
            options={options}
          />
        </div>
      </div>
    );
  },
);

ChartPanel.displayName = 'ChartPanel';
