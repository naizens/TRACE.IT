import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { ChartData } from 'chart.js';
import { useStore } from '../../store/useStore';
import { useChartSync } from '../../hooks/useChartSync';
import { useTrackMapUpdate } from '../../hooks/useTrackMapUpdate';
import type { TrackMapHandle } from '../trackmap';
import { CH, createRideOptions, buildRideData } from './rideHeightUtils';
import { RidePanel } from './RidePanel';

// ── Panel definitions ─────────────────────────────────────────────────────────

const PANELS = [
  { id: 'splitter', label: 'Splitter', legend: 'avg(LF, RF)' },
  { id: 'front',    label: 'Front',    legend: 'bright = LF · dark = RF' },
  { id: 'rear',     label: 'Rear',     legend: 'bright = LR · dark = RR' },
] as const;
type PanelId = typeof PANELS[number]['id'];
const INITIAL_FLEX: Record<string, number> = { splitter: 1, front: 1, rear: 1 };

// ── RideHeightView ────────────────────────────────────────────────────────────

interface Props {
  trackMapRef: RefObject<TrackMapHandle | null>;
}

export function RideHeightView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);

  const onMapUpdate = useTrackMapUpdate(trackMapRef);

  const { register, unregister, handleZoom, handleHover, handleReset, updateLimits } = useChartSync(onMapUpdate);

  // Stable refs so options closures never go stale
  const zoomRef  = useRef<typeof handleZoom  | null>(null);
  const hoverRef = useRef<typeof handleHover | null>(null);
  zoomRef.current  = handleZoom;
  hoverRef.current = handleHover;

  // Options created once — callbacks read through refs
  const chartOptions = useMemo(
    () => ({
      splitter: createRideOptions('splitter', zoomRef, hoverRef),
      front:    createRideOptions('front',    zoomRef, hoverRef),
      rear:     createRideOptions('rear',     zoomRef, hoverRef),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const data = useMemo(
    () => buildRideData(sessions, selections),
    [sessions, selections],
  );

  // Sync x-axis upper bound whenever data changes
  useEffect(() => {
    if (data) updateLimits(data.maxDist);
  }, [data?.maxDist, updateLimits]);

  const handleDblClick = useCallback(() => {
    if (data) handleReset(data.maxDist);
  }, [data, handleReset]);

  const registerChart  = useCallback((id: string, c: import('chart.js').Chart) => register(id, c), [register]);
  const unregisterChart = useCallback((id: string) => unregister(id), [unregister]);

  const [visiblePanels, setVisiblePanels] = useState<Set<string>>(
    () => new Set(PANELS.map((p) => p.id)),
  );
  const togglePanel = useCallback((id: string) => {
    setVisiblePanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Panel resize
  const [flexMap, setFlexMap] = useState<Record<string, number>>(INITIAL_FLEX);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback(
    (idA: string, idB: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const startY    = e.clientY;
      const startFlex = { ...flexMap };
      const totalFlex = Object.values(startFlex).reduce((a, b) => a + b, 0);

      const onMouseMove = (ev: MouseEvent) => {
        const dy          = ev.clientY - startY;
        const totalHeight = containerRef.current?.clientHeight ?? 400;
        const dyFlex      = (dy / totalHeight) * totalFlex;
        setFlexMap((prev) => ({
          ...prev,
          [idA]: Math.max(0.25, (startFlex[idA] ?? 1) + dyFlex),
          [idB]: Math.max(0.25, (startFlex[idB] ?? 1) - dyFlex),
        }));
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
    [flexMap],
  );

  const resetFlex = useCallback(() => setFlexMap(INITIAL_FLEX), []);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        Open an IBT file to view ride heights.
      </div>
    );
  }

  const hasData = (sessions[0]?.data[CH.lf]?.length ?? 0) > 0;
  if (!hasData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No ride height data found in this IBT file.
      </div>
    );
  }

  const empty: ChartData<'line'> = { datasets: [] };

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Ride Heights
        </span>
        <span className="text-[10px] text-muted">· mm · over lap distance</span>
        <div className="flex items-center gap-1.5 ml-auto">
          {PANELS.map((p) => {
            const active = visiblePanels.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePanel(p.id)}
                className={[
                  'px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors',
                  active ? 'border-border bg-surface-2 text-text' : 'border-border/30 text-muted/40',
                ].join(' ')}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-muted">
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6"><line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5"/></svg>
            Left
          </span>
          <span className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6"><line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45"/></svg>
            Right
          </span>
        </div>
      </div>

      {Object.keys(selections).length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
          Select laps from the sidebar to compare
        </div>
      ) : (() => {
        const visible = PANELS.filter((p) => visiblePanels.has(p.id));
        const panelData = (id: PanelId) =>
          id === 'splitter' ? (data?.splitter ?? empty)
          : id === 'front'  ? (data?.front    ?? empty)
          :                    (data?.rear     ?? empty);
        return (
          <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
            {visible.map((p, i) => (
              <div key={p.id} style={{ flex: flexMap[p.id] }} className="relative flex flex-col min-h-0">
                <RidePanel
                  id={p.id}
                  label={p.id === 'splitter' ? 'Front Splitter' : p.label}
                  legend={p.legend}
                  chartData={panelData(p.id)}
                  options={chartOptions[p.id]}
                  onRegister={registerChart}
                  onUnregister={unregisterChart}
                  onWheelPan={handleZoom}
                  onDblClick={handleDblClick}
                />
                {i < visible.length - 1 && (
                  <div
                    className="absolute bottom-0 inset-x-0 h-4 translate-y-1/2 z-10 cursor-ns-resize group"
                    onMouseDown={handleResizeStart(p.id, visible[i + 1].id)}
                    onDoubleClick={resetFlex}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border pointer-events-none" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-2 rounded-full bg-surface-2 border border-border group-hover:border-accent/50 transition-colors pointer-events-none" />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
