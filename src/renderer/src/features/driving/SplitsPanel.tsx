import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { COLOR_ORDER, getLapColor } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';
import { formatLapTime } from '../../lib/formatters';

export interface SplitsPanelHandle {
  /** Move the position-indicator (left accent border) to the sector containing dist. */
  updatePosition:  (dist: number) => void;
  /** Highlight a sector as zoom-active (blue tint). Pass null to clear. */
  setActiveSector: (idx: number | null) => void;
}

interface Props {
  onSectorClick: (idx: number, start: number, end: number, maxDist: number) => void;
  onFullLap:     () => void;
}

interface SectorRow {
  label:   string;
  lapTime: number;
  refTime: number;
  delta:   number;
  start:   number;
  end:     number;
}

export const SplitsPanel = forwardRef<SplitsPanelHandle, Props>(
  ({ onSectorClick, onFullLap }, ref) => {
    const sessions   = useStore((s) => s.sessions);
    const selections = useStore((s) => s.selections);
    const session    = sessions[0] ?? null;

    const { rows, total, lapColor, refColor, maxDist, hasCmp } = useMemo(() => {
      const empty = { rows: [] as SectorRow[], total: null as null | { lap: number; ref: number; delta: number }, lapColor: '', refColor: '', maxDist: 0, hasCmp: false };

      if (!session || Object.keys(selections).length === 0) return empty;

      const entries = COLOR_ORDER
        .map((color) => {
          const key = Object.keys(selections).find((k) => selections[k] === color);
          if (!key) return null;
          const colon = key.indexOf(':');
          const si    = parseInt(key.substring(0, colon));
          const li    = parseInt(key.substring(colon + 1));
          const sess  = sessions[si];
          const lap   = sess?.laps[li];
          if (!sess || !lap) return null;
          return { sess, lap, color };
        })
        .filter(Boolean) as Array<{ sess: typeof sessions[0]; lap: typeof sessions[0]['laps'][0]; color: typeof COLOR_ORDER[number] }>;

      if (entries.length === 0) return empty;

      const ref = entries[0];
      const cmp = entries[1] ?? null;

      const sectors = session.meta.sectors ?? [];
      if (sectors.length === 0) return empty;

      const buildTimes = (e: typeof ref) => {
        const s = e.lap.start_idx, en = e.lap.end_idx + 1;
        const distRaw = e.sess.data['LapDist']     ?? new Float32Array();
        const stRaw   = e.sess.data['SessionTime'] ?? new Float32Array();
        const t0   = stRaw[s] ?? 0;
        const dist = distRaw.subarray(s, en);
        const time = new Float32Array(en - s);
        for (let i = 0; i < en - s; i++) time[i] = stRaw[s + i] - t0;
        return { dist, time };
      };

      const refData = buildTimes(ref);
      const cmpData = cmp ? buildTimes(cmp) : null;
      const md = refData.dist[refData.dist.length - 1] ?? 0;
      if (md === 0) return empty;

      const bounds = [0, ...sectors, 1];
      const rows: SectorRow[] = bounds.slice(0, -1).map((start, i) => {
        const end = bounds[i + 1];
        const d0  = start * md, d1 = end * md;
        const refT = interpolate(refData.dist, refData.time, d1) - interpolate(refData.dist, refData.time, d0);
        const lapT = cmpData
          ? interpolate(cmpData.dist, cmpData.time, d1) - interpolate(cmpData.dist, cmpData.time, d0)
          : refT;
        return { label: `S${i + 1}`, lapTime: lapT, refTime: refT, delta: lapT - refT, start, end };
      });

      const totalRef = ref.lap.lap_time_s;
      const totalLap = cmp ? cmp.lap.lap_time_s : totalRef;

      return {
        rows,
        total:   { lap: totalLap, ref: totalRef, delta: totalLap - totalRef },
        lapColor: cmp ? getLapColor(cmp.color) : getLapColor(ref.color),
        refColor: getLapColor(ref.color),
        maxDist:  md,
        hasCmp:   !!cmp,
      };
    }, [sessions, selections, session]);

    // ── Imperative refs ───────────────────────────────────────────────────────
    const rowRefs        = useRef<(HTMLElement | null)[]>([]);
    const fullLapBtnRef  = useRef<HTMLButtonElement>(null);
    const posIdxRef      = useRef(-1);
    const activeIdxRef   = useRef<number | null>(null);
    const regionsRef     = useRef(rows.map((r) => ({ start: r.start, end: r.end })));
    const maxDistRef     = useRef(maxDist);
    regionsRef.current   = rows.map((r) => ({ start: r.start, end: r.end }));
    maxDistRef.current   = maxDist;

    useImperativeHandle(ref, () => ({
      updatePosition: (dist: number) => {
        const regs = regionsRef.current;
        const md   = maxDistRef.current;
        if (!regs.length || md === 0) return;

        const pct = dist / md;
        let newIdx = regs.length - 1;
        for (let i = 0; i < regs.length; i++) {
          if (pct <= regs[i].end) { newIdx = i; break; }
        }
        if (newIdx === posIdxRef.current) return;

        // Remove old position border
        const prev = rowRefs.current[posIdxRef.current];
        if (prev) prev.style.borderLeft = '';

        // Add new position border
        const next = rowRefs.current[newIdx];
        if (next) next.style.borderLeft = '2px solid var(--color-accent)';

        posIdxRef.current = newIdx;
      },

      setActiveSector: (idx: number | null) => {
        // Clear previous row highlight (skip for idx < 0)
        const prev = activeIdxRef.current;
        if (prev !== null && prev >= 0) {
          const prevEl = rowRefs.current[prev];
          if (prevEl) prevEl.style.backgroundColor = '';
        }

        // Apply new row highlight (skip for idx < 0, i.e. zoom-only state)
        if (idx !== null && idx >= 0) {
          const newEl = rowRefs.current[idx];
          if (newEl) newEl.style.backgroundColor = 'rgba(59,130,246,0.22)';
        }

        activeIdxRef.current = idx;

        // Full Lap button: show whenever any zoom is active (idx !== null)
        if (fullLapBtnRef.current) {
          fullLapBtnRef.current.style.display = idx !== null ? 'flex' : 'none';
        }
      },
    }));

    if (rows.length === 0) return null;

    return (
      <div className="shrink-0 border-b border-border select-none">
        {/* Header */}
        <div className="flex items-center h-6 px-2 border-b border-border bg-surface-2">
          <span
            className="flex-1 text-right text-[9px] font-bold uppercase tracking-widest"
            style={{ color: hasCmp ? lapColor : refColor }}
          >
            LAP
          </span>
          <span className="w-10 text-center text-[9px] font-bold text-muted uppercase tracking-widest">
            SPLITS
          </span>
          {hasCmp ? (
            <span className="flex-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: refColor }}>
              REF
            </span>
          ) : (
            <span className="flex-1" />
          )}
          {/* Full Lap button — hidden until a sector is active */}
          <button
            ref={fullLapBtnRef}
            type="button"
            className="items-center justify-center h-4 px-2 ml-1 rounded text-[9px] font-bold tracking-widest uppercase text-accent hover:text-text hover:bg-white/10 transition-colors cursor-pointer border border-border"
            style={{ display: 'none' }}
            onMouseDown={(e) => { e.stopPropagation(); onFullLap(); }}
          >
            Full Lap
          </button>
        </div>

        {/* Sector rows */}
        {rows.map((row, i) => (
          <div
            key={row.label}
            ref={(el) => { rowRefs.current[i] = el; }}
            className="flex items-center h-7 px-2 cursor-pointer hover:bg-white/5 transition-colors"
            style={{ borderLeft: '2px solid transparent' }}
            onMouseDown={() => onSectorClick(i, row.start, row.end, maxDist)}
          >
            {hasCmp ? (
              <span
                className="flex-1 text-right text-[12px] font-bold tabular-nums"
                style={{ color: row.delta < 0 ? '#22c55e' : row.delta > 0 ? '#ef4444' : 'var(--color-text)' }}
              >
                {row.lapTime.toFixed(3)}
              </span>
            ) : (
              <span className="flex-1 text-right text-[12px] font-bold tabular-nums text-text">
                {row.refTime.toFixed(3)}
              </span>
            )}

            <span className="w-10 text-center text-[10px] font-bold text-muted">{row.label}</span>

            {hasCmp ? (
              <span className="flex-1 text-[11px] tabular-nums text-muted">{row.refTime.toFixed(3)}</span>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        ))}

        {/* Total row */}
        {total && (
          <div className="flex items-center h-7 px-2 border-t border-border">
            {hasCmp ? (
              <span
                className="flex-1 text-right text-[12px] font-bold tabular-nums"
                style={{ color: total.delta < 0 ? '#22c55e' : total.delta > 0 ? '#ef4444' : 'var(--color-text)' }}
              >
                {formatLapTime(total.lap)}
              </span>
            ) : (
              <span className="flex-1 text-right text-[12px] font-bold tabular-nums text-text">
                {formatLapTime(total.ref)}
              </span>
            )}
            <span className="w-10 text-center text-[11px] text-muted">⏱</span>
            {hasCmp ? (
              <span className="flex-1 text-[11px] tabular-nums text-muted">{formatLapTime(total.ref)}</span>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        )}
      </div>
    );
  },
);

SplitsPanel.displayName = 'SplitsPanel';
