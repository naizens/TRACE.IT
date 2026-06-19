import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../../store/useStore';
import { getLapColor, COLOR_ORDER } from '../../lib/constants';
import { useTrackMapUpdate } from '../../hooks/useTrackMapUpdate';
import { TrackMap } from '../trackmap';
import type { TrackMapHandle, LapEntry, DeltaData } from '../trackmap';
import { DrivingHUD } from './DrivingHUD';
import type { TelemetryBarHandle } from '../trackmap/TelemetryBar';
import { DeltaChart } from './DeltaChart';
import type { DeltaChartHandle } from './DeltaChart';
import { DrivingTraces } from './DrivingTraces';
import type { DrivingTracesHandle } from './DrivingTraces';
import { SplitsPanel } from './SplitsPanel';
import type { SplitsPanelHandle } from './SplitsPanel';

interface Props {
  trackMapRef: RefObject<TrackMapHandle | null>;
}

export function DrivingView({ trackMapRef }: Props) {
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const session    = sessions[0] ?? null;

  const hudRef          = useRef<TelemetryBarHandle>(null);
  const drivingHudRef   = useRef<TelemetryBarHandle>(null);
  const tracesRef       = useRef<DrivingTracesHandle>(null);
  const deltaChartRef   = useRef<DeltaChartHandle>(null);
  const splitsPanelRef  = useRef<SplitsPanelHandle>(null);
  const onMapUpdate     = useTrackMapUpdate(trackMapRef, drivingHudRef);

  const [activeSectorIdx, setActiveSectorIdx] = useState<number | null>(null);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackSpeedRef  = useRef(1);
  playbackSpeedRef.current = playbackSpeed;
  const totalLapTimeRef   = useRef(0);
  const playRafRef        = useRef<number | null>(null);
  const playPosRef        = useRef(0);
  const playLastTimeRef   = useRef<number | null>(null);
  const isPlayingRef      = useRef(false);

  // ── Track laps + delta data from selections ───────────────────────────────
  const { trackLaps, deltaData, maxDist, refColor, cmpColor, totalLapTime } = useMemo<{
    trackLaps: LapEntry[] | undefined;
    deltaData: DeltaData | undefined;
    maxDist: number;
    refColor: string;
    cmpColor: string;
    totalLapTime: number;
  }>(() => {
    if (!session || Object.keys(selections).length === 0)
      return { trackLaps: undefined, deltaData: undefined, maxDist: 0, refColor: '', cmpColor: '', totalLapTime: 0 };


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
        return { sess, lap, lapIdx: li, color };
      })
      .filter(Boolean) as Array<{
        sess: typeof sessions[0];
        lap: typeof sessions[0]['laps'][0];
        lapIdx: number;
        color: typeof COLOR_ORDER[number];
      }>;

    if (entries.length === 0) return { trackLaps: undefined, deltaData: undefined, maxDist: 0, refColor: '', cmpColor: '', totalLapTime: 0 };

    const ref = entries[0];
    const cmp = entries[1] ?? null;

    const trackLaps: LapEntry[] = [{ session: ref.sess, lapIdx: ref.lapIdx, color: getLapColor(ref.color) }];

    // Total time for the reference lap (for playback speed calculation)
    const stArr = ref.sess.data['SessionTime'] ?? new Float32Array();
    const t0st  = stArr[ref.lap.start_idx] ?? 0;
    const totalLapTime = (stArr[ref.lap.end_idx] ?? t0st) - t0st;

    let deltaData: DeltaData | undefined;
    if (cmp) {
      const rs = ref.lap.start_idx, re = ref.lap.end_idx + 1;
      const cs = cmp.lap.start_idx, ce = cmp.lap.end_idx + 1;
      const rd = ref.sess.data, cd = cmp.sess.data;

      const refTimeRaw = rd['SessionTime'] ?? new Float32Array();
      const cmpTimeRaw = cd['SessionTime'] ?? new Float32Array();
      const t0ref = refTimeRaw[rs] ?? 0;
      const t0cmp = cmpTimeRaw[cs] ?? 0;

      const refTime = new Float32Array(re - rs);
      const cmpTime = new Float32Array(ce - cs);
      for (let i = 0; i < re - rs; i++) refTime[i] = refTimeRaw[rs + i] - t0ref;
      for (let i = 0; i < ce - cs; i++) cmpTime[i] = cmpTimeRaw[cs + i] - t0cmp;

      deltaData = {
        refDist: (rd['LapDist'] ?? new Float32Array()).subarray(rs, re),
        refTime,
        cmpDist: (cd['LapDist'] ?? new Float32Array()).subarray(cs, ce),
        cmpTime,
      };
    }

    const lapDistArr = ref.sess.data['LapDist'] ?? new Float32Array();
    const maxDist    = lapDistArr[ref.lap.end_idx] ?? 0;

    return {
      trackLaps,
      deltaData,
      maxDist,
      refColor: getLapColor(ref.color),
      cmpColor: cmp ? getLapColor(cmp.color) : '',
      totalLapTime,
    };
  }, [sessions, selections, session]);

  // ── Scrubbing (shared between sector bar, delta chart, bottom scrubber) ───
  const scrubberRef      = useRef<HTMLDivElement>(null);
  const deltaBarRef      = useRef<HTMLDivElement>(null);
  const playheadRef      = useRef<HTMLDivElement>(null);
  const deltaPlayheadRef = useRef<HTMLDivElement>(null);
  const isDragging       = useRef(false);
  const scrubElRef       = useRef<HTMLElement | null>(null);
  const maxDistRef       = useRef(maxDist);
  maxDistRef.current     = maxDist;
  totalLapTimeRef.current = totalLapTime;

  const scrubByPct = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(1, pct));
    playPosRef.current = clamped;
    if (playheadRef.current)      playheadRef.current.style.left      = `${clamped * 100}%`;
    if (deltaPlayheadRef.current) deltaPlayheadRef.current.style.left = `${clamped * 100}%`;
    const dist = clamped * maxDistRef.current;
    onMapUpdate(dist);
    splitsPanelRef.current?.updatePosition(dist);
  }, [onMapUpdate]);

  const scrubFromEl = useCallback((clientX: number) => {
    const el = scrubElRef.current;
    if (!el || maxDistRef.current === 0) return;
    const rect = el.getBoundingClientRect();
    scrubByPct((clientX - rect.left) / rect.width);
  }, [scrubByPct]);

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    if (playRafRef.current !== null) { cancelAnimationFrame(playRafRef.current); playRafRef.current = null; }
    playLastTimeRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (isPlayingRef.current) return;
    if (totalLapTimeRef.current <= 0) return;
    if (playPosRef.current >= 1) playPosRef.current = 0;
    isPlayingRef.current = true;
    setIsPlaying(true);
    playLastTimeRef.current = null;

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;
      if (playLastTimeRef.current !== null) {
        const dt     = (now - playLastTimeRef.current) / 1000;
        const newPos = playPosRef.current + (dt * playbackSpeedRef.current) / totalLapTimeRef.current;
        if (newPos >= 1) {
          scrubByPct(1);
          tracesRef.current?.syncHover(maxDistRef.current);
          deltaChartRef.current?.syncHover(maxDistRef.current);
          isPlayingRef.current = false;
          setIsPlaying(false);
          playRafRef.current = null;
          return;
        }
        const dist = newPos * maxDistRef.current;
        scrubByPct(newPos);
        tracesRef.current?.syncHover(dist);
        deltaChartRef.current?.syncHover(dist);
      }
      playLastTimeRef.current = now;
      playRafRef.current = requestAnimationFrame(tick);
    };

    playRafRef.current = requestAnimationFrame(tick);
  }, [scrubByPct]);

  // Stop playback on unmount
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const startDrag = useCallback((el: HTMLElement, clientX: number) => {
    stopPlayback();
    scrubElRef.current = el;
    isDragging.current = true;
    scrubFromEl(clientX);
    let rafId: number | null = null;
    let lastX = clientX;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      lastX = ev.clientX;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => { rafId = null; if (isDragging.current) scrubFromEl(lastX); });
    };
    const onUp = () => {
      isDragging.current = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [scrubFromEl, stopPlayback]);

  // ── Sector regions ────────────────────────────────────────────────────────
  const sectorRegions = useMemo(() => {
    const s = session?.meta.sectors ?? [];
    if (s.length === 0) return [];
    const bounds = [0, ...s, 1];
    return bounds.slice(0, -1).map((start, i) => ({
      start,
      end:   bounds[i + 1],
      label: `S${i + 1}`,
    }));
  }, [session]);


  // ── Empty state ───────────────────────────────────────────────────────────
  if (!session) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

    {/* ── Main row: track map + HUD ──────────────────────────────────────────── */}
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── Left column: track map + delta chart ──────────────────────────── */}
      <div className="flex flex-col overflow-hidden min-h-0" style={{ width: '52%' }}>

        {/* Track map */}
        <div className="relative flex-1 overflow-hidden">
          <TrackMap
            ref={trackMapRef}
            session={session}
            trackLaps={trackLaps}
            deltaData={deltaData}
            telemetryRef={hudRef}
          />
          {deltaData && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none select-none">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-[10px] font-bold tracking-wider" style={{ color: '#ef4444' }}>LOSING TIME</span>
            </div>
          )}
        </div>

        {/* HUD — between track map and delta chart */}
        <div className="shrink-0 border-t border-border bg-surface select-none">
          <DrivingHUD ref={drivingHudRef} />
        </div>

        {/* Delta chart (below HUD, only when 2 laps selected) */}
        {deltaData && (
          <div
            ref={deltaBarRef}
            className="relative shrink-0 border-t border-border bg-surface cursor-crosshair select-none"
            style={{ height: 80 }}
            onMouseDown={(e) => startDrag(e.currentTarget, e.clientX)}
          >
            <DeltaChart
              ref={deltaChartRef}
              deltaData={deltaData}
              maxDist={maxDist}
              refColor={refColor}
              cmpColor={cmpColor}
              sectorRange={activeSectorIdx !== null ? sectorRegions[activeSectorIdx] : null}
              onDistHover={(dist) => {
                scrubByPct(dist / maxDistRef.current);
                tracesRef.current?.syncHover(dist);
                onMapUpdate(dist);
              }}
            />
            <div
              ref={deltaPlayheadRef}
              className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
              style={{ left: '0%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-accent)' }}
            />
          </div>
        )}
      </div>

      {/* ── Right: splits + driving traces ──────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden min-h-0 border-l border-border" style={{ width: '48%' }}>

        <SplitsPanel
          ref={splitsPanelRef}
          onSectorClick={(i, start, end, md) => {
            setActiveSectorIdx(i);
            splitsPanelRef.current?.setActiveSector(i);
            scrubByPct(start);
            trackMapRef.current?.zoomToSector(start, end);
            tracesRef.current?.setXRange(start * md, end * md);
          }}
          onFullLap={() => {
            setActiveSectorIdx(null);
            splitsPanelRef.current?.setActiveSector(null);
            trackMapRef.current?.resetZoom();
            tracesRef.current?.resetXRange();
          }}
        />

        {/* Telemetry traces */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <DrivingTraces
            ref={tracesRef}
            sessions={sessions}
            selections={selections}
            onDistHover={(dist) => {
              scrubByPct(dist / maxDistRef.current);
              onMapUpdate(dist);
              deltaChartRef.current?.syncHover(dist);
            }}
            onZoom={() => {
              setActiveSectorIdx(null);
              splitsPanelRef.current?.setActiveSector(-1);
            }}
          />
        </div>

      </div>

    </div>

    {/* ── Distance scrubber + playback controls (bottom) ───────────────────── */}
    {maxDist > 0 && (
      <div className="shrink-0 h-7 bg-surface-2 border-t border-border select-none flex items-stretch">

        {/* Playback controls */}
        <div className="flex items-center gap-0.5 shrink-0 px-1.5 border-r border-border">
          <button
            type="button"
            className="w-6 h-5 flex items-center justify-center rounded text-[12px] text-text hover:bg-white/10 transition-colors cursor-pointer"
            onMouseDown={(e) => { e.stopPropagation(); isPlaying ? stopPlayback() : startPlayback(); }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {([0.5, 1, 2, 4] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              className="px-1 h-5 flex items-center justify-center rounded text-[9px] font-bold tracking-tight transition-colors cursor-pointer"
              style={{ color: playbackSpeed === spd ? 'var(--color-accent)' : 'var(--color-muted)' }}
              onMouseDown={(e) => { e.stopPropagation(); setPlaybackSpeed(spd); }}
            >
              {spd}×
            </button>
          ))}
        </div>

        {/* Scrubber track */}
        <div
          ref={scrubberRef}
          className="relative flex-1 cursor-crosshair"
          onMouseDown={(e) => startDrag(e.currentTarget, e.clientX)}
        >
          <div className="absolute inset-0 flex items-center px-2">
            <div className="w-full h-px bg-border" />
          </div>
          {/* Sector range overlay */}
          {activeSectorIdx !== null && sectorRegions[activeSectorIdx] && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left:            `${sectorRegions[activeSectorIdx].start * 100}%`,
                width:           `${(sectorRegions[activeSectorIdx].end - sectorRegions[activeSectorIdx].start) * 100}%`,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderLeft:      '1px solid rgba(255,255,255,0.35)',
                borderRight:     '1px solid rgba(255,255,255,0.35)',
              }}
            />
          )}
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-px bg-accent pointer-events-none z-10"
            style={{ left: '0%', transform: 'translateX(-50%)' }}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none">0m</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none">{Math.round(maxDist)}m</span>
        </div>

      </div>
    )}

    </div>
  );
}
