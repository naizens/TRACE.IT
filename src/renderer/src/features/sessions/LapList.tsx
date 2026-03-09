import { useState } from 'react';
import { CheckIcon } from '@heroicons/react/16/solid';
import { useStore } from '../../store/useStore';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';
import { formatLapTime } from '../../lib/formatters';
import type { LapColor, ParsedSession, LapInfo } from '../../types/session';

interface TooltipData {
  airTemp:    number | null;
  trackTemp:  number | null;
  humidity:   number | null;
  fuelStart:  number | null;
  fuelEnd:    number | null;
  y:          number;
}

function getLapTooltipData(session: ParsedSession, lap: LapInfo, mouseY: number): TooltipData {
  const { data, meta } = session;
  const si = lap.start_idx;
  const ei = lap.end_idx;

  return {
    airTemp:   data['AirTemp']?.[si]   ?? null,
    trackTemp: data['TrackTemp']?.[si] ?? null,
    humidity:  meta.humidity_pct,
    fuelStart: data['FuelLevel']?.[si] ?? null,
    fuelEnd:   data['FuelLevel']?.[ei] ?? null,
    y:         mouseY,
  };
}

function fmt1(v: number | null): string {
  return v === null ? '—' : v.toFixed(1);
}
function fmt2(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

function LapTooltip({ data }: { data: TooltipData }) {
  const fuelUsed =
    data.fuelStart !== null && data.fuelEnd !== null
      ? data.fuelStart - data.fuelEnd
      : null;

  const humidity = data.humidity;

  const rows: [string, string][] = [
    ['Air Temp',      `${fmt1(data.airTemp)}°C`],
    ['Track Temp',    `${fmt1(data.trackTemp)}°C`],
    ['Rel. Humidity', `${fmt1(humidity)}%`],
    ['Fuel at Start', `${fmt2(data.fuelStart)}L`],
    ['Fuel at End',   `${fmt2(data.fuelEnd)}L`],
    ['Fuel Used',     `${fmt2(fuelUsed)}L`],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: 272,
        top:  data.y - 68,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="bg-surface border border-border rounded px-2.5 py-1.5 shadow-lg"
    >
      <table className="text-[10px] font-mono border-separate border-spacing-x-3 border-spacing-y-0">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="text-muted text-right whitespace-nowrap">{label}</td>
              <td className="text-text tabular-nums whitespace-nowrap">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LapList() {
  const sessions       = useStore((s) => s.sessions);
  const selections     = useStore((s) => s.selections);
  const toggleLapColor = useStore((s) => s.toggleLapColor);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
      <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
        Laps
      </p>

      {sessions.map((session, sessionIdx) => {
        const lapTimes   = session.laps.map((l) => l.lap_time_s || l.duration_s);
        const timedLaps  = session.laps.map((l) => l.lap_time_s).filter((t) => t > 0).sort((a, b) => a - b);
        const median     = timedLaps.length > 0 ? timedLaps[Math.floor(timedLaps.length / 2)] : Infinity;
        const minFullLap = median * 0.5;
        const fastest    = timedLaps
          .filter((t) => t >= minFullLap)
          .reduce((min, t) => (t < min ? t : min), Infinity);

        return (
          <div key={`${session._filename}-${sessionIdx}`} className="mb-2">
            {/* Session group header */}
            {sessions.length > 1 && (
              <p
                className="text-[9px] font-semibold truncate px-1 mb-0.5"
                style={{ color: sessionIdx === 0 ? '#00ff88' : '#a1a1aa' }}
                title={session._filename}
              >
                S{sessionIdx + 1} · {session._filename}
              </p>
            )}

            {session.laps.map((lap, lapIdx) => {
              const t         = lapTimes[lapIdx];
              const isFastest = lap.lap_time_s >= minFullLap && lap.lap_time_s === fastest;
              const selKey    = `${sessionIdx}:${lapIdx}`;
              const activeColor = selections[selKey] as LapColor | undefined;

              return (
                <div
                  key={`${sessionIdx}-${lapIdx}`}
                  className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-surface-2 transition-colors"
                  onMouseEnter={(e) =>
                    setTooltip(getLapTooltipData(session, lap, e.clientY))
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Colour selector checkboxes */}
                  <div className="flex gap-0.5 shrink-0">
                    {COLOR_ORDER.map((color) => {
                      const isActive = activeColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => toggleLapColor(sessionIdx, lapIdx, color)}
                          title={`Assign ${color} to Lap ${lap.lap}`}
                          className="w-3.5 h-3.5 rounded-sm border cursor-pointer transition-all hover:scale-110 focus:outline-none flex items-center justify-center"
                          style={{
                            borderColor: isActive ? getLapColor(color) : 'var(--color-border)',
                            background:  isActive ? `${getLapColor(color)}22` : 'transparent',
                          }}
                        >
                          {isActive && (
                            <CheckIcon
                              className="w-2.5 h-2.5"
                              style={{ color: getLapColor(color) }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lap info */}
                  <div className="flex-1 flex items-center justify-end gap-2 font-mono min-w-0">
                    <span
                      className={`text-[11px] tabular-nums ${
                        isFastest ? 'text-yellow-400' : 'text-text'
                      }`}
                    >
                      {isFastest && <span className="text-[9px] mr-0.5">★</span>}
                      {formatLapTime(t)}
                    </span>
                    <span className="text-[9px] text-muted shrink-0">L{lap.lap}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {tooltip && <LapTooltip data={tooltip} />}
    </div>
  );
}
