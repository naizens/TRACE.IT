import { useRef, useMemo, useEffect, useCallback } from 'react';
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

export function TelemetryView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const onMapUpdate = useTrackMapUpdate(trackMapRef);

  // ── Chart sync ────────────────────────────────────────────────────────────
  const { register, unregister, handleHover, handleZoom, handleReset, updateLimits } =
    useChartSync(onMapUpdate);

  // Stable mutable refs for callbacks — lets chartOptions be created once
  const hoverRef = useRef<typeof handleHover | null>(null);
  const zoomRef  = useRef<typeof handleZoom | null>(null);
  hoverRef.current = handleHover;
  zoomRef.current  = handleZoom;

  // ── Chart options (created once, callbacks read via refs) ─────────────────
  const chartOptions = useMemo(
    () =>
      CHART_CONFIGS.map((cfg) =>
        createChartOptions({ id: cfg.id, fixedScale: cfg.fixedScale, hoverRef, zoomRef }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Chart data (recomputed on session/selection change) ───────────────────
  const chartData = useMemo(() => {
    if (sessions.length === 0 || Object.keys(selections).length === 0) return null;
    return buildChartData(sessions, selections);
  }, [sessions, selections]);

  // ── Sync X limits when session (maxDist) changes ──────────────────────────
  useEffect(() => {
    if (chartData) updateLimits(chartData.maxDist);
  }, [chartData?.maxDist, updateLimits]);

  // ── Double-click → reset zoom to full lap distance ────────────────────────
  const handleDblClick = useCallback(() => {
    if (chartData) handleReset(chartData.maxDist);
  }, [chartData, handleReset]);

  // ── Register callbacks (type-compatible overload for ChartPanel) ──────────
  const registerChart = useCallback(
    (id: string, instance: Chart) => register(id, instance),
    [register],
  );
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

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
      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden min-w-0">
        {Object.keys(selections).length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
            Select laps from the sidebar to compare
          </div>
        ) : (
          CHART_CONFIGS.map((cfg, i) => (
            <ChartPanel
              key={cfg.id}
              id={cfg.id}
              label={cfg.label}
              datasets={chartData?.datasets[cfg.id as keyof typeof chartData.datasets] ?? []}
              options={chartOptions[i]}
              flex={cfg.flex}
              onRegister={registerChart}
              onUnregister={unregisterChart}
              onDblClick={handleDblClick}
              onWheelPan={handleZoom}
            />
          ))
        )}
      </div>

    </div>
  );
}
