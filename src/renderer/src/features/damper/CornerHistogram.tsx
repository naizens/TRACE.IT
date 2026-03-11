import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions, Plugin } from 'chart.js';

export interface CornerHistogramProps {
  label:        string;
  chartData:    ChartData<'bar'>;
  chartOptions: ChartOptions<'bar'>;
  plugin:       Plugin<'bar'>;
  /** Changes when threshold or range change — forces chart remount so the plugin closure is fresh. */
  chartKey:     string;
}

export function CornerHistogram({ label, chartData, chartOptions, plugin, chartKey }: CornerHistogramProps) {
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
