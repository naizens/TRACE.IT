import { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import type { RefObject } from 'react';
import { useStore } from '../../store/useStore';
import { CHART_CONFIGS } from '../../lib/constants';
import { buildChartData } from '../../lib/buildChartData';
import { createChartOptions } from './createChartOptions';
import { useChartSync } from '../../hooks/useChartSync';
import { useTrackMapUpdate } from '../../hooks/useTrackMapUpdate';
import { ChartPanel } from './ChartPanel';
import type { TrackMapHandle } from '../trackmap';
import type { Chart } from 'chart.js';

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

const INITIAL_FLEX = CHART_CONFIGS.map((c) => c.flex);

export function TelemetryView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const onMapUpdate = useTrackMapUpdate(trackMapRef);

  // ── Chart sync ────────────────────────────────────────────────────────────
  const { register, unregister, handleHover, handleZoom, handleReset, updateLimits } =
    useChartSync(onMapUpdate);

  const hoverRef = useRef<typeof handleHover | null>(null);
  const zoomRef  = useRef<typeof handleZoom | null>(null);
  hoverRef.current = handleHover;
  zoomRef.current  = handleZoom;

  // ── Chart options (created once) ──────────────────────────────────────────
  const chartOptions = useMemo(
    () =>
      CHART_CONFIGS.map((cfg) =>
        createChartOptions({ id: cfg.id, fixedScale: cfg.fixedScale, hoverRef, zoomRef }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (sessions.length === 0 || Object.keys(selections).length === 0) return null;
    return buildChartData(sessions, selections);
  }, [sessions, selections]);

  useEffect(() => {
    if (chartData) updateLimits(chartData.maxDist);
  }, [chartData?.maxDist, updateLimits]);

  const handleDblClick = useCallback(() => {
    if (chartData) handleReset(chartData.maxDist);
  }, [chartData, handleReset]);

  const registerChart   = useCallback((id: string, instance: Chart) => register(id, instance), [register]);
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

  // ── Panel resize ──────────────────────────────────────────────────────────
  const [flexValues, setFlexValues] = useState<number[]>(INITIAL_FLEX);
  const containerRef = useRef<HTMLDivElement>(null);

  // Capture current flex at drag-start so the mousemove closure has no stale values
  const handleResizeStart = useCallback(
    (i: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      const startY    = e.clientY;
      const startFlex = [...flexValues];
      const totalFlex = startFlex.reduce((a, b) => a + b, 0);

      const onMouseMove = (ev: MouseEvent) => {
        const dy          = ev.clientY - startY;
        const totalHeight = containerRef.current?.clientHeight ?? 400;
        const dyFlex      = (dy / totalHeight) * totalFlex;
        const next = [...startFlex];
        next[i]     = Math.max(0.25, startFlex[i]     + dyFlex);
        next[i + 1] = Math.max(0.25, startFlex[i + 1] - dyFlex);
        setFlexValues(next);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup',   onMouseUp);
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor     = 'ns-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup',   onMouseUp);
    },
    [flexValues],
  );

  const resetFlex = useCallback(() => setFlexValues(INITIAL_FLEX), []);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted select-none">
        <ArrowUpTrayIcon className="w-10 h-10 opacity-40" />
        <p className="text-xs tracking-wider uppercase">Open an IBT file to begin</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">
      {/* ── Chart column ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden min-w-0">
        {Object.keys(selections).length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
            Select laps from the sidebar to compare
          </div>
        ) : (
          CHART_CONFIGS.map((cfg, i) => (
            <div key={cfg.id} className="relative flex flex-col min-h-0" style={{ flex: flexValues[i] }}>
              <ChartPanel
                id={cfg.id}
                label={cfg.label}
                datasets={chartData?.datasets[cfg.id as keyof typeof chartData.datasets] ?? []}
                options={chartOptions[i]}
                flex={1}
                onRegister={registerChart}
                onUnregister={unregisterChart}
                onDblClick={handleDblClick}
                onWheelPan={handleZoom}
              />
              {i < CHART_CONFIGS.length - 1 && (
                <div
                  className="absolute bottom-0 inset-x-0 h-4 translate-y-1/2 z-10 cursor-ns-resize group"
                  onMouseDown={handleResizeStart(i)}
                  onDoubleClick={resetFlex}
                >
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border pointer-events-none" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-2 rounded-full bg-surface-2 border border-border group-hover:border-accent/50 transition-colors pointer-events-none" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
