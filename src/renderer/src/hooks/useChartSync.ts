import { useRef, useCallback } from 'react';
import type { Chart } from 'chart.js';

type MapUpdateCallback = (lapDist: number) => void;

/**
 * Manages cross-chart hover & zoom synchronisation without triggering
 * React re-renders — all operations go directly to Chart.js instances.
 */
export function useChartSync(onMapUpdate?: MapUpdateCallback) {
  // Store live Chart.js instances keyed by chart id
  const charts = useRef<Record<string, Chart>>({});

  const register = useCallback((id: string, instance: Chart) => {
    charts.current[id] = instance;
  }, []);

  const unregister = useCallback((id: string) => {
    delete charts.current[id];
  }, []);

  /** Sync tooltip position across all other charts when one chart is hovered */
  const handleHover = useCallback(
    (sourceId: string, dataIndex: number, lapDist: number) => {
      for (const [id, chart] of Object.entries(charts.current)) {
        if (id === sourceId || !chart) continue;
        const meta = chart.getDatasetMeta(0);
        const point = meta?.data?.[dataIndex];
        if (!point) continue;
        const activeEls = chart.data.datasets.map((_, i) => ({
          datasetIndex: i,
          index: dataIndex,
        }));
        chart.tooltip?.setActiveElements(activeEls, { x: point.x, y: point.y });
        chart.draw();
      }
      onMapUpdate?.(lapDist);
    },
    [onMapUpdate],
  );

  /** Sync X-axis zoom/pan range when one chart is zoomed */
  const handleZoom = useCallback((sourceId: string, min: number, max: number) => {
    for (const [id, chart] of Object.entries(charts.current)) {
      if (id === sourceId || !chart) continue;
      const xScale = chart.options.scales?.['x'];
      if (!xScale) continue;
      xScale.min = min;
      xScale.max = max;
      chart.update('none');
    }
  }, []);

  /** Reset zoom on all charts to the full session distance */
  const handleReset = useCallback((maxDist: number) => {
    for (const chart of Object.values(charts.current)) {
      if (!chart) continue;
      chart.resetZoom();
      const xScale = chart.options.scales?.['x'];
      if (xScale) {
        xScale.min = 0;
        xScale.max = maxDist;
      }
      chart.update('none');
    }
  }, []);

  /** Set X-axis limits on all charts (called when session/data changes) */
  const updateLimits = useCallback((maxDist: number) => {
    for (const chart of Object.values(charts.current)) {
      if (!chart) continue;
      const xScale = chart.options.scales?.['x'];
      if (xScale) xScale.max = maxDist;
      const zoom = (chart.options.plugins as Record<string, unknown>)?.['zoom'] as
        | Record<string, unknown>
        | undefined;
      const limits = zoom?.['limits'] as Record<string, unknown> | undefined;
      if (limits?.['x']) (limits['x'] as Record<string, unknown>)['max'] = maxDist;
      chart.update('none');
    }
  }, []);

  return { register, unregister, handleHover, handleZoom, handleReset, updateLimits };
}
