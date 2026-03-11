import type { ChartOptions } from 'chart.js';
import { buildZoomPlugin, buildClickHandler, type HoverRef, type ZoomRef } from '../../lib/syncChartConfig';

// ── Corner / position definitions ────────────────────────────────────────────

export const CORNERS = [
  { id: 'LF', label: 'Left Front',  keys: ['LFtempL', 'LFtempM', 'LFtempR'] },
  { id: 'RF', label: 'Right Front', keys: ['RFtempR', 'RFtempM', 'RFtempL'] },
  { id: 'LR', label: 'Left Rear',   keys: ['LRtempL', 'LRtempM', 'LRtempR'] },
  { id: 'RR', label: 'Right Rear',  keys: ['RRtempR', 'RRtempM', 'RRtempL'] },
] as const;

// Outer / Mid / Inner — left tires: tempL=outer, tempR=inner; right tires: tempR=outer, tempL=inner.
export const POS_LABELS = ['Outer', 'Mid', 'Inner'] as const;

// 0 = full colour, higher = darker (mixed toward black)
export const POS_DARKEN = [0, 0.45, 0.68] as const;

// ── Chart options factory ─────────────────────────────────────────────────────

export function createTireTempOptions(args: {
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
