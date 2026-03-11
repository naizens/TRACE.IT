import { useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions, Chart } from 'chart.js';

export interface RidePanelProps {
  id:           string;
  label:        string;
  legend?:      string;
  chartData:    ChartData<'line'>;
  options:      ChartOptions<'line'>;
  onRegister:   (id: string, chart: Chart) => void;
  onUnregister: (id: string) => void;
  onWheelPan:   (id: string, min: number, max: number) => void;
  onDblClick:   () => void;
}

export function RidePanel({
  id, label, legend, chartData, options,
  onRegister, onUnregister, onWheelPan, onDblClick,
}: RidePanelProps) {
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
