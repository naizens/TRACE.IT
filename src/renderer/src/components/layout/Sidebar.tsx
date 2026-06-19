import { useRef, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../../store/useStore';
import { Button } from '../ui/Button';
import { SessionList } from '../../features/sessions/SessionList';
import { LapList } from '../../features/sessions/LapList';
import { TrackMap, TelemetryBar, type TrackMapHandle, type TelemetryBarHandle, type LapEntry } from '../../features/trackmap';
import { ArrowUpTrayIcon } from '@heroicons/react/16/solid';
import { LAP_COLORS, COLOR_ORDER } from '../../lib/constants';
import { SectorGapsPanel } from '../../features/driving/SectorGapsPanel';

const MIN_WIDTH  = 200;
const MAX_WIDTH  = 520;
const MIN_MAP_H  = 80;
const MAX_MAP_H  = 480;

interface Props {
  trackMapRef: RefObject<TrackMapHandle | null>;
}

export function Sidebar({ trackMapRef }: Props) {
  const addSessions  = useStore((s) => s.addSessions);
  const sessions     = useStore((s) => s.sessions);
  const selections   = useStore((s) => s.selections);
  const activeTab    = useStore((s) => s.activeTab);
  const session      = sessions[0] ?? null;
  const telemetryRef = useRef<TelemetryBarHandle>(null);
  const [width, setWidth]       = useState(260);
  const [mapHeight, setMapHeight] = useState(192);

  // True only when the session has at least one genuine full lap.
  const hasFullLap = useMemo(() => {
    if (!session) return false;
    const times  = session.laps.map((l) => l.lap_time_s).filter((t) => t > 0).sort((a, b) => a - b);
    const median = times.length > 0 ? times[Math.floor(times.length / 2)] : Infinity;
    return times.some((t) => t >= median * 0.5);
  }, [session]);

  // One entry per selected lap (max 2, sorted slower-first so the faster lap
  // is drawn last (on top) as the visual reference line.
  const trackLaps = useMemo<LapEntry[]>(() => {
    const laps: LapEntry[] = [];
    for (const color of COLOR_ORDER) {
      if (laps.length >= 2) break;
      const key = Object.keys(selections).find((k) => selections[k] === color);
      if (key) {
        const colon = key.indexOf(':');
        const sIdx  = parseInt(key.substring(0, colon));
        const lIdx  = parseInt(key.substring(colon + 1));
        const sess = sessions[sIdx];
        if (sess) {
          const lap      = sess.laps[lIdx];
          const times    = sess.laps.map((l) => l.lap_time_s).filter((t) => t > 0).sort((a, b) => a - b);
          const median   = times.length > 0 ? times[Math.floor(times.length / 2)] : Infinity;
          const minFull  = median * 0.5;
          if (lap && lap.lap_time_s >= minFull) {
            laps.push({ session: sess, lapIdx: lIdx, color: LAP_COLORS[color] });
          }
        }
      }
    }
    // Slower lap first → faster lap drawn last (on top as reference line)
    laps.sort((a, b) => {
      const timeA = a.session.laps[a.lapIdx].lap_time_s;
      const timeB = b.session.laps[b.lapIdx].lap_time_s;
      return timeB - timeA;
    });
    return laps;
  }, [selections, sessions]);

  async function handleOpenFiles() {
    const results = await window.electronAPI.openIbtFiles();
    if (results) addSessions(results);
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = width;

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + ev.clientX - startX));
      setWidth(next);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }

  return (
    <div className="relative shrink-0" style={{ width }}>
      <aside className="w-full h-full bg-surface border-r border-border flex flex-col p-3 overflow-hidden">
        {/* Open button */}
        <Button
          variant="accent"
          size="sm"
          onClick={handleOpenFiles}
          className="w-full mb-3 uppercase tracking-widest"
        >
          <ArrowUpTrayIcon className="w-3 h-3" />
          Open IBT Files
        </Button>

        {/* Divider */}
        <div className="border-t border-border mb-3" />

        {/* Session badges */}
        <SessionList />

        {/* Lap list — scrollable, takes remaining space */}
        <LapList />

        {/* Sector gaps — only on Driving tab */}
        {activeTab === 'driving' && <SectorGapsPanel />}

        {/* Track map — pinned to sidebar bottom, hidden on Driving tab (has its own map) */}
        {hasFullLap && activeTab !== 'driving' && (
          <>
            <div className="border-t border-border mt-2 mb-1 shrink-0" />

            <span className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1 shrink-0">
              Track Map
            </span>

            {/* Telemetry overlay */}
            <TelemetryBar ref={telemetryRef} />

            {/* Canvas container — resize handle floats on top edge */}
            <div
              className="relative mt-1.5 shrink-0 bg-surface-2 border border-border rounded overflow-hidden"
              style={{ height: mapHeight }}
            >
              <TrackMap ref={trackMapRef} session={session} trackLaps={trackLaps} telemetryRef={telemetryRef} />
              <div
                className="absolute top-0 inset-x-0 h-4 z-10 cursor-ns-resize group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY  = e.clientY;
                  const startH  = mapHeight;
                  const onMove  = (ev: MouseEvent) => {
                    const next = Math.min(MAX_MAP_H, Math.max(MIN_MAP_H, startH - (ev.clientY - startY)));
                    setMapHeight(next);
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup',   onUp);
                    document.body.style.cursor     = '';
                    document.body.style.userSelect = '';
                  };
                  document.body.style.cursor     = 'ns-resize';
                  document.body.style.userSelect = 'none';
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup',   onUp);
                }}
                onDoubleClick={() => setMapHeight(192)}
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-border pointer-events-none" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-2 rounded-full bg-surface-2 border border-border group-hover:border-accent/50 transition-colors pointer-events-none" />
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Col-resize handle — lives OUTSIDE aside so overflow-hidden doesn't clip it ── */}
      <div
        className="absolute right-0 top-0 bottom-0 w-4 translate-x-1/2 cursor-col-resize z-20 group"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-border pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-2 rounded-full bg-surface-2 border border-border group-hover:border-accent/50 transition-colors pointer-events-none" />
      </div>
    </div>
  );
}
