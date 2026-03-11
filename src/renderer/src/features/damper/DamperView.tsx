import { useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';
import {
  RANGE_OPTIONS, LS_THRESHOLDS,
  makeBins, buildHistogram, computeZones, makeLsBandPlugin, makeChartOptions,
  type RangeOption, type LsThreshold, type ZoneStat,
} from './damperUtils';
import { CornerHistogram } from './CornerHistogram';
import type { ChartData } from 'chart.js';

// ── Corners ───────────────────────────────────────────────────────────────────

const CORNERS = [
  { key: 'LFshockVel', label: 'Left Front'  },
  { key: 'RFshockVel', label: 'Right Front' },
  { key: 'LRshockVel', label: 'Left Rear'   },
  { key: 'RRshockVel', label: 'Right Rear'  },
] as const;

// ── DamperView ────────────────────────────────────────────────────────────────

export function DamperView() {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);

  const [lsThreshold, setLsThreshold] = useState<LsThreshold>(50);
  const [range, setRange]             = useState<RangeOption>(200);
  const [visibleCorners, setVisibleCorners] = useState<Set<string>>(
    () => new Set(CORNERS.map((c) => c.key)),
  );
  const toggleCorner = useCallback((key: string) => {
    setVisibleCorners((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const { labels: binLabels } = useMemo(() => makeBins(range), [range]);

  const chartOptions = useMemo(() => makeChartOptions(range), [range]);

  // Mutable ref read by the plugin on every draw — always current, no chart remount needed.
  const statsRef = useRef<ZoneStat[][]>(CORNERS.map(() => []));

  const { cornerChartData, cornerZoneStats } = useMemo(() => {
    const emptyChart = (): ChartData<'bar'> => ({ labels: binLabels, datasets: [] });
    const noData = {
      cornerChartData: CORNERS.map(emptyChart),
      cornerZoneStats: CORNERS.map((): ZoneStat[] => []),
    };

    if (sessions.length === 0) return noData;

    const multiSession = sessions.length > 1;

    const selectedLaps = COLOR_ORDER
      .filter((color) => Object.values(selections).includes(color))
      .map((color) => {
        const key = Object.keys(selections).find((k) => selections[k] === color);
        if (!key) return null;
        const colon      = key.indexOf(':');
        const sessionIdx = parseInt(key.substring(0, colon));
        const lapIdx     = parseInt(key.substring(colon + 1));
        const sess       = sessions[sessionIdx];
        if (!sess) return null;
        const lapInfo = sess.laps[lapIdx];
        if (!lapInfo) return null;
        return { color, lapInfo, session: sess, sessionIdx };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (selectedLaps.length === 0) return noData;

    const multiLap = selectedLaps.length > 1;

    const cornerChartData:  ChartData<'bar'>[] = [];
    const cornerZoneStats:  ZoneStat[][]       = [];

    for (const { key } of CORNERS) {
      const datasets:    ChartData<'bar'>['datasets'] = [];
      const cornerStats: ZoneStat[]                  = [];

      for (const { color, lapInfo, session: sess, sessionIdx } of selectedLaps) {
        const raw      = sess.data[key]?.slice(lapInfo.start_idx, lapInfo.end_idx + 1) ?? new Float32Array();
        const hexColor = getLapColor(color);
        const lapLabel = multiSession ? `S${sessionIdx + 1}·L${lapInfo.lap}` : `L${lapInfo.lap}`;
        const { data, bg, border } = buildHistogram(raw, range, binLabels, lsThreshold, hexColor);
        const zones = computeZones(raw, lsThreshold);

        datasets.push({
          label: lapLabel,
          data,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          grouped: multiLap,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        });
        cornerStats.push({ lapLabel, hexColor, ...zones });
      }

      cornerChartData.push({ labels: binLabels, datasets });
      cornerZoneStats.push(cornerStats);
    }

    return { cornerChartData, cornerZoneStats };
  }, [sessions, selections, lsThreshold, range, binLabels]);

  // Sync stats into the ref every render so the plugin closure reads the latest values.
  statsRef.current = cornerZoneStats;

  // Plugins recreated only when threshold/range change (chart remounts via chartKey).
  // They read live data from statsRef on every draw — no stale closure.
  const cornerPlugins = useMemo(
    () => CORNERS.map((_, i) => makeLsBandPlugin(lsThreshold, range, statsRef, i)),
    [lsThreshold, range],
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        Open an IBT file to view damper histograms.
      </div>
    );
  }

  const hasShockData = (sessions[0]?.data['LFshockVel']?.length ?? 0) > 0;
  if (!hasShockData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No shock velocity data found in this IBT file.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-4 gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Damper Histograms
          </span>
          <span className="text-[10px] text-muted">· shock velocity · mm/s</span>
        </div>

        {/* Corner toggles */}
        <div className="flex items-center gap-1.5">
          {CORNERS.map((c) => {
            const active = visibleCorners.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCorner(c.key)}
                className={[
                  'px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors',
                  active ? 'border-border bg-surface-2 text-text' : 'border-border/30 text-muted/40',
                ].join(' ')}
              >
                {c.key.replace('shockVel', '')}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Range selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted uppercase tracking-wider">Range</span>
            <div className="flex rounded overflow-hidden border border-border">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={[
                    'px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors',
                    range === r
                      ? 'bg-accent text-black'
                      : 'text-muted hover:text-text hover:bg-surface-2',
                  ].join(' ')}
                >
                  ±{r}
                </button>
              ))}
            </div>
          </div>

          {/* LS/HS threshold selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted uppercase tracking-wider">LS/HS split</span>
            <div className="flex rounded overflow-hidden border border-border">
              {LS_THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setLsThreshold(t)}
                  className={[
                    'px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors',
                    lsThreshold === t
                      ? 'bg-accent text-black'
                      : 'text-muted hover:text-text hover:bg-surface-2',
                  ].join(' ')}
                >
                  ±{t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2-col grid, rows adapt to visible count */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${Math.ceil(visibleCorners.size / 2)}, 1fr)` }}>
        {CORNERS.map((corner, i) => visibleCorners.has(corner.key) && (
          <CornerHistogram
            key={corner.key}
            label={corner.label}
            chartData={cornerChartData[i]}
            chartOptions={chartOptions}
            plugin={cornerPlugins[i]}
            chartKey={`${lsThreshold}-${range}`}
          />
        ))}
      </div>
    </div>
  );
}
