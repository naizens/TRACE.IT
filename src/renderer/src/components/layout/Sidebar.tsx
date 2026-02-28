import type { RefObject } from 'react';
import { useStore } from '../../store/useStore';
import { Button } from '../ui/Button';
import { SessionList } from '../../features/sessions/SessionList';
import { LapList } from '../../features/sessions/LapList';
import { TrackMap, type TrackMapHandle } from '../../features/trackmap/TrackMap';

interface Props {
  trackMapRef: RefObject<TrackMapHandle>;
}

export function Sidebar({ trackMapRef }: Props) {
  const addSessions = useStore((s) => s.addSessions);
  const sessions    = useStore((s) => s.sessions);
  const session     = sessions[0] ?? null;

  async function handleOpenFiles() {
    const results = await window.electronAPI.openIbtFiles();
    if (results) addSessions(results);
  }

  return (
    <aside className="w-[260px] flex-shrink-0 bg-surface border-r border-border flex flex-col p-3 overflow-hidden">
      {/* Open button */}
      <Button
        variant="accent"
        size="sm"
        onClick={handleOpenFiles}
        className="w-full mb-3 uppercase tracking-widest"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
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
          <div className="relative h-[185px] flex-shrink-0 bg-surface-2 border border-border rounded overflow-hidden">
            <TrackMap ref={trackMapRef} session={session} />
          </div>
        </>
      )}
    </aside>
  );
}
