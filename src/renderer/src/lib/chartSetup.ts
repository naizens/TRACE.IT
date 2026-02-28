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

// ── Custom plugin: vertical cursor line across all synced charts ──────────────
const SyncCursorPlugin = {
  id: 'syncCursor',
  afterDraw(chart: Chart) {
    const tooltip = chart.tooltip;
    if (!tooltip || tooltip.opacity === 0) return;

    const { ctx, chartArea } = chart;
    const x = tooltip.caretX;

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
