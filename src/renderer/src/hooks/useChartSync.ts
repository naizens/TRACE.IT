import { useRef, useCallback } from 'react';
import type { Chart } from 'chart.js';
import { setPinnedCursor, clearPinnedCursor } from '../lib/chartSetup';

type MapUpdateCallback = (lapDist: number) => void;

/**
 * Manages cross-chart click/drag sync without triggering React re-renders.
 * All operations go directly to Chart.js instances.
 */
export function useChartSync(onMapUpdate?: MapUpdateCallback) {
  const charts = useRef<Record<string, Chart>>({});
  const dragCleanups = useRef<Record<string, () => void>>({});

  /**
   * Stable ref so drag handlers (set up inside register's closure) always
   * call the latest handleHover without stale closure issues.
   */
  const syncRef = useRef<(sourceId: string, dataIndex: number, lapDist: number) => void>(
    () => {},
  );

  /**
   * Pin cursor on click or drag: uses xScale.getPixelForValue(lapDist) so all
   * peer charts receive correct canvas coordinates regardless of height or decimation.
   */
  const handleHover = useCallback(
    (sourceId: string, dataIndex: number, lapDist: number) => {
      setPinnedCursor(dataIndex, lapDist);
      for (const [, chart] of Object.entries(charts.current)) {
        if (!chart) continue;
        const xScale = chart.scales['x'];
        if (!xScale) continue;
        const px = xScale.getPixelForValue(lapDist);
        const { top, bottom } = chart.chartArea;
        const activeEls = chart.data.datasets.map((_, i) => ({
          datasetIndex: i,
          index: dataIndex,
        }));
        chart.tooltip?.setActiveElements(activeEls, { x: px, y: (top + bottom) / 2 });
        chart.setActiveElements(activeEls);
        chart.draw();
      }
      onMapUpdate?.(lapDist);
    },
    [onMapUpdate],
  );

  // Keep the ref current so drag handlers never capture a stale version.
  syncRef.current = handleHover;

  const register = useCallback((id: string, instance: Chart) => {
    charts.current[id] = instance;

    // ── Drag-to-scrub: sync cursor while holding left mouse button ────────────
    const canvas = instance.canvas;
    let dragging = false;
    let rafId: number | null = null;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left button only
      dragging = true;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      // Throttle to one update per animation frame
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!dragging) return;
        const els = instance.getElementsAtEventForMode(
          e as unknown as Event,
          'index',
          { intersect: false },
          false,
        );
        if (!els.length) return;
        const idx = els[0].index;
        const lapDist = (instance.data.datasets[0]?.data[idx] as { x: number } | undefined)?.x;
        if (lapDist !== undefined) syncRef.current(id, idx, lapDist);
      });
    };

    const onMouseUp = () => { dragging = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    dragCleanups.current[id] = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const unregister = useCallback((id: string) => {
    dragCleanups.current[id]?.();
    delete dragCleanups.current[id];
    delete charts.current[id];
  }, []);

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

  /** Zoom all charts to an explicit x range */
  const zoomAll = useCallback((min: number, max: number) => {
    for (const chart of Object.values(charts.current)) {
      if (!chart) continue;
      const xScale = chart.options.scales?.['x'];
      if (xScale) { xScale.min = min; xScale.max = max; }
      chart.update('none');
    }
  }, []);

  /** Set X-axis limits on all charts (called when session/data changes) */
  const updateLimits = useCallback((maxDist: number) => {
    clearPinnedCursor();
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

  return { register, unregister, handleHover, handleZoom, handleReset, updateLimits, zoomAll };
}
