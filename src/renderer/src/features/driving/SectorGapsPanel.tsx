import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { COLOR_ORDER, getLapColor } from '../../lib/constants';
import { interpolate } from '../../lib/interpolate';

export function SectorGapsPanel() {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const { sectorGaps, refColor, cmpColor } = useMemo(() => {
    if (!session || Object.keys(selections).length < 2)
      return { sectorGaps: [], refColor: '', cmpColor: '' };

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

    if (entries.length < 2) return { sectorGaps: [], refColor: '', cmpColor: '' };

    const ref = entries[0];
    const cmp = entries[1];

    const sectors = session.meta.sectors ?? [];
    if (sectors.length === 0) return { sectorGaps: [], refColor: getLapColor(ref.color), cmpColor: getLapColor(cmp.color) };

    // Build time-zero'd arrays
    const rs = ref.lap.start_idx, re = ref.lap.end_idx + 1;
    const cs = cmp.lap.start_idx, ce = cmp.lap.end_idx + 1;
    const refDistRaw = ref.sess.data['LapDist'] ?? new Float32Array();
    const cmpDistRaw = cmp.sess.data['LapDist'] ?? new Float32Array();
    const refStRaw   = ref.sess.data['SessionTime'] ?? new Float32Array();
    const cmpStRaw   = cmp.sess.data['SessionTime'] ?? new Float32Array();

    const refDist = refDistRaw.subarray(rs, re);
    const cmpDist = cmpDistRaw.subarray(cs, ce);

    const t0ref = refStRaw[rs] ?? 0;
    const t0cmp = cmpStRaw[cs] ?? 0;
    const refTime = new Float32Array(re - rs);
    const cmpTime = new Float32Array(ce - cs);
    for (let i = 0; i < re - rs; i++) refTime[i] = refStRaw[rs + i] - t0ref;
    for (let i = 0; i < ce - cs; i++) cmpTime[i] = cmpStRaw[cs + i] - t0cmp;

    const maxDist = refDist[refDist.length - 1] ?? 0;
    if (maxDist === 0) return { sectorGaps: [], refColor: getLapColor(ref.color), cmpColor: getLapColor(cmp.color) };

    const bounds = [0, ...sectors, 1];
    const sectorGaps = bounds.slice(0, -1).map((start, i) => {
      const end = bounds[i + 1];
      const d0 = start * maxDist;
      const d1 = end   * maxDist;
      const refT = interpolate(refDist, refTime, d1) - interpolate(refDist, refTime, d0);
      const cmpT = interpolate(cmpDist, cmpTime, d1) - interpolate(cmpDist, cmpTime, d0);
      return { label: `S${i + 1}`, ref: refT, delta: cmpT - refT };
    });

    return { sectorGaps, refColor: getLapColor(ref.color), cmpColor: getLapColor(cmp.color) };
  }, [sessions, selections, session]);

  if (sectorGaps.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-border pt-2 pb-1.5 px-1 select-none">
      <div className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1.5">Sector Gaps</div>

      {/* Header */}
      <div className="flex items-center mb-1">
        <span className="w-7" />
        <span className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-text">
          <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: refColor, display: 'inline-block', flexShrink: 0 }} />
          1
        </span>
        <span className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-text">
          <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: cmpColor, display: 'inline-block', flexShrink: 0 }} />
          2
        </span>
      </div>

      {/* Rows */}
      {sectorGaps.map((g) => (
        <div key={g.label} className="flex items-center mb-0.5">
          <span className="w-7 text-[10px] font-bold text-muted">{g.label}</span>
          <span className="flex-1 text-[11px] font-bold tabular-nums text-text text-center">
            {g.ref.toFixed(3)}
          </span>
          <span
            className="flex-1 text-[11px] font-black tabular-nums text-center rounded px-1 py-px"
            style={{
              color:           g.delta <= 0 ? '#14532d' : '#7f1d1d',
              backgroundColor: g.delta <= 0 ? '#22c55e' : '#ef4444',
            }}
          >
            {g.delta > 0 ? '+' : ''}{g.delta.toFixed(3)}s
          </span>
        </div>
      ))}
    </div>
  );
}
