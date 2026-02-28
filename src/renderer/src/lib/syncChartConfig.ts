import type { ChartEvent, ActiveElement, Chart } from 'chart.js';
import type React from 'react';

// ── Shared ref types ──────────────────────────────────────────────────────────

export type HoverRef = React.MutableRefObject<
  ((id: string, index: number, lapDist: number) => void) | null
>;

export type ZoomRef = React.MutableRefObject<
  ((id: string, min: number, max: number) => void) | null
>;

// ── Shared builders ───────────────────────────────────────────────────────────

/**
 * Returns the chartjs-plugin-zoom config used by all synced chart factories:
 * wheel scroll = disabled (handled as pan in the panel component),
 * Ctrl+drag = box zoom, interactive drag-pan = disabled.
 */
export function buildZoomPlugin(id: string, zoomRef: ZoomRef) {
  return {
    limits: { x: { min: 0, max: 'original' as const, minRange: 100 } },
    zoom: {
      wheel: { enabled: false },
      pinch: { enabled: true },
      drag:  { enabled: true, modifierKey: 'ctrl' as const },
      mode:  'x' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onZoom: ({ chart }: { chart: any }) =>
        zoomRef.current?.(id, chart.scales.x.min, chart.scales.x.max),
    },
    pan: { enabled: false, mode: 'x' as const },
  };
}

/**
 * Returns the onClick callback that pins the crosshair tooltip and track
 * marker position across all charts registered with the same useChartSync instance.
 */
export function buildClickHandler(id: string, hoverRef: HoverRef) {
  return (_event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
    if (!elements?.length) return;
    const index   = elements[0].index;
    const lapDist = (chart.data.datasets[0]?.data[index] as { x: number } | undefined)?.x;
    if (lapDist !== undefined) hoverRef.current?.(id, index, lapDist);
  };
}
