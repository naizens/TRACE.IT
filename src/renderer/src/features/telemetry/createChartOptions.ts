import type { ChartOptions } from 'chart.js';
import { buildZoomPlugin, buildClickHandler, type HoverRef, type ZoomRef } from '../../lib/syncChartConfig';

interface CreateChartOptionsArgs {
  id: string;
  fixedScale: boolean;
  /** Mutable ref — always points to the current hover handler, avoiding stale closures */
  hoverRef: HoverRef;
  /** Mutable ref — always points to the current zoom/pan handler */
  zoomRef: ZoomRef;
}

/**
 * Factory that builds a stable Chart.js options object.
 * Callbacks are read through mutable refs so the object can be created
 * once (in a useMemo with [] deps) without ever becoming stale.
 */
export function createChartOptions({
  id,
  fixedScale,
  hoverRef,
  zoomRef,
}: CreateChartOptionsArgs): ChartOptions<'line'> {
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
            if (id === 'thr' || id === 'brk') return `${Math.round(val.y)} %`;
            if (id === 'delta') return `${val.y >= 0 ? '+' : ''}${val.y.toFixed(3)} s`;
            if (id === 'gear')  return `${val.y.toFixed(0)}`;
            return val.y.toFixed(1);
          },
          labelTextColor: (item) => item.dataset.borderColor as string,
        },
      },

      // Shared zoom/pan plugin config (Ctrl+drag zoom, wheel pan handled in ChartPanel)
      zoom: buildZoomPlugin(id, zoomRef),
    },

    scales: {
      x: {
        type:    'linear',
        display: true,
        min:     0,
        ticks: {
          color: '#52525b',
          font:  { size: 8 },
          maxTicksLimit: 10,
          padding: 1,
          callback: (value) => `${value}m`,
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
      y: {
        min: fixedScale ? 0 : undefined,
        max: fixedScale ? 105 : undefined,
        ticks: {
          color: '#52525b',
          font:  { size: 8 },
          maxTicksLimit: 3,
          padding: 2,
        },
        grid: {
          color: (ctx) =>
            id === 'delta' && ctx.tick.value === 0
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.04)',
          lineWidth: (ctx) =>
            id === 'delta' && ctx.tick.value === 0 ? 1.5 : 1,
        },
        border: { display: false },
      },
    },

    // Click handler — pins crosshair + track marker across all charts
    onClick: buildClickHandler(id, hoverRef),
  };
}
