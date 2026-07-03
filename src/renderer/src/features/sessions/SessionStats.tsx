import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { computeSessionStats } from '../../lib/lapStats';
import { formatLapTime } from '../../lib/formatters';

export function SessionStats() {
  const sessions = useStore((s) => s.sessions);

  const rows = useMemo(
    () => sessions.map((session) => ({ session, stats: computeSessionStats(session) })),
    [sessions],
  );

  if (sessions.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1.5">
        Session Stats
      </p>
      <div className="flex flex-col gap-1">
        {rows.map(({ session, stats }, i) => (
          <div
            key={`${session._filename}-${i}`}
            className="flex items-center justify-between px-1 font-mono text-[9px]"
            title={stats.validLapCount === 0 ? 'No valid (non-pit) laps' : `${stats.validLapCount} valid lap(s)`}
          >
            <span className="text-muted uppercase tracking-widest">Avg lap</span>
            <span className="text-text tabular-nums">
              {stats.avgLapTimeS !== null ? formatLapTime(stats.avgLapTimeS) : '--:--.---'}
            </span>
            <span className="text-muted uppercase tracking-widest">Avg fuel</span>
            <span className="text-text tabular-nums">
              {stats.avgFuelPerLapL !== null ? `${stats.avgFuelPerLapL.toFixed(2)}L` : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
