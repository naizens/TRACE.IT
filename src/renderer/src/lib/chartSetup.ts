/**
 * Global Chart.js registration — imported once in main.tsx before any chart renders.
 * Keeps tree-shaking efficient by only registering what this app actually uses.
 */
import {
  Chart,
  LineController,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Decimation,
} from 'chart.js';
import 'hammerjs'; // peer dependency for chartjs-plugin-zoom pinch/pan
import ZoomPlugin from 'chartjs-plugin-zoom';

// ── Pinned cursor state — set on click, cleared when data changes ─────────────

interface PinnedCursor { dataIndex: number; lapDist: number }
let pinnedCursor: PinnedCursor | null = null;

/** Call from useChartSync whenever the user clicks a chart. */
export function setPinnedCursor(dataIndex: number, lapDist: number): void {
  pinnedCursor = { dataIndex, lapDist };
}

/** Call from useChartSync when session data changes, so stale cursor is cleared. */
export function clearPinnedCursor(): void {
  pinnedCursor = null;
}

// ── SyncCursorPlugin — draws a vertical dashed line at the pinned position ────

const SyncCursorPlugin = {
  id: 'syncCursor',

  /**
   * On mouseleave, restore the pinned tooltip so it stays visible.
   * (Only relevant when hover events are still in the events list.)
   */
  afterEvent(chart: Chart, args: { event: { type: string }; changed?: boolean }): void {
    if (pinnedCursor === null || args.event.type !== 'mouseleave') return;
    const xScale = chart.scales['x'];
    if (!xScale) return;
    const px = xScale.getPixelForValue(pinnedCursor.lapDist);
    const { top, bottom } = chart.chartArea;
    const activeEls = chart.data.datasets.map((_, i) => ({ datasetIndex: i, index: pinnedCursor!.dataIndex }));
    chart.tooltip?.setActiveElements(activeEls, { x: px, y: (top + bottom) / 2 });
    chart.setActiveElements(activeEls);
    args.changed = true;
  },

  /** Draw the vertical cursor line at the pinned or currently-active tooltip position. */
  afterDraw(chart: Chart) {
    const tooltip = chart.tooltip;

    let x: number | null = null;
    if (tooltip && tooltip.opacity > 0) {
      // Live tooltip visible — use its caret position
      x = tooltip.caretX;
    } else if (pinnedCursor !== null) {
      // No live tooltip — fall back to pinned position via scale
      const xScale = chart.scales['x'];
      if (xScale) x = xScale.getPixelForValue(pinnedCursor.lapDist);
    }
    if (x === null) return;

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(
  LineController,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  ZoomPlugin,
  SyncCursorPlugin,
  Decimation,
);

// Windows display scaling often produces non-integer devicePixelRatio values
// (e.g. 1.25, 1.5) which cause sub-pixel blurriness on canvas elements.
// Ceiling to the next integer ensures crisp backing stores in all cases.
Chart.defaults.devicePixelRatio = Math.ceil(window.devicePixelRatio);
