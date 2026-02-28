import { useRef } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../../store/useStore';
import { Button } from '../ui/Button';
import { SessionList } from '../../features/sessions/SessionList';
import { LapList } from '../../features/sessions/LapList';
import { TrackMap, TelemetryBar, type TrackMapHandle, type TelemetryBarHandle } from '../../features/trackmap';
import { ArrowUpTrayIcon } from '@heroicons/react/16/solid';

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

export function Sidebar({ trackMapRef }: Props) {
  const addSessions  = useStore((s) => s.addSessions);
  const sessions     = useStore((s) => s.sessions);
  const session      = sessions[0] ?? null;
  const telemetryRef = useRef<TelemetryBarHandle>(null);

  async function handleOpenFiles() {
    const results = await window.electronAPI.openIbtFiles();
    if (results) addSessions(results);
  }

  return (
    <aside className="w-65 shrink-0 bg-surface border-r border-border flex flex-col p-3 overflow-hidden">
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

      {/* Track map — pinned to sidebar bottom */}
      {session && (
        <>
          <div className="border-t border-border mt-2 mb-2" />
          <span className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
            Track Map
          </span>

          {/* Telemetry overlay — separate element above the map */}
          <TelemetryBar ref={telemetryRef} />

          {/* Canvas container */}
          <div className="relative h-48 mt-1.5 shrink-0 bg-surface-2 border border-border rounded overflow-hidden">
            <TrackMap ref={trackMapRef} session={session} telemetryRef={telemetryRef} />
          </div>
        </>
      )}
    </aside>
  );
}
