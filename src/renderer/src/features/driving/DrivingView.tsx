import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import type { RefObject } from 'react';
import { MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
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
  const sessions    = useStore((s) => s.sessions);
  const selections  = useStore((s) => s.selections);
  const boundaries  = useStore((s) => s.boundaries);
  const session     = sessions[0] ?? null;

  const hudRef          = useRef<TelemetryBarHandle>(null);
  const drivingHudRef   = useRef<TelemetryBarHandle>(null);
  const tracesRef       = useRef<DrivingTracesHandle>(null);
  const deltaChartRef   = useRef<DeltaChartHandle>(null);
  const splitsPanelRef  = useRef<SplitsPanelHandle>(null);
  const onMapUpdate     = useTrackMapUpdate(trackMapRef, drivingHudRef);

  const [activeSectorIdx,  setActiveSectorIdx]  = useState<number | null>(null);
  const [followZoom,       setFollowZoom]       = useState(() => { const v = localStorage.getItem('drivingFollowZoom'); return v !== null ? Number(v) : 7; });
  const [zoomOpen,         setZoomOpen]         = useState(false);
  const tracesWidth = 700;
  const [tracesCollapsed,  setTracesCollapsed]  = useState(false);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackSpeedRef    = useRef(1);
  playbackSpeedRef.current  = playbackSpeed;
  const totalLapTimeRef     = useRef(0);
  const playRafRef          = useRef<number | null>(null);
  const playPosRef          = useRef(0);
  const playLastTimeRef     = useRef<number | null>(null);
  const isPlayingRef        = useRef(false);
  const activeSectorRangeRef = useRef<{ start: number; end: number } | null>(null);

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
    if (cmp) trackLaps.push({ session: cmp.sess, lapIdx: cmp.lapIdx, color: getLapColor(cmp.color) });

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

  const zoomPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!zoomOpen) return;
    const onDown = (e: MouseEvent) => {
      if (zoomPanelRef.current && !zoomPanelRef.current.contains(e.target as Node)) {
        setZoomOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [zoomOpen]);

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
    const range   = activeSectorRangeRef.current;
    const lo      = range ? range.start : 0;
    const hi      = range ? range.end   : 1;
    const clamped = Math.max(lo, Math.min(hi, pct));
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
    const range    = activeSectorRangeRef.current;
    const startBnd = range ? range.start : 0;
    const endBnd   = range ? range.end   : 1;
    if (playPosRef.current >= endBnd) playPosRef.current = startBnd;
    isPlayingRef.current = true;
    setIsPlaying(true);
    playLastTimeRef.current = null;

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;
      if (playLastTimeRef.current !== null) {
        const dt     = (now - playLastTimeRef.current) / 1000;
        const newPos = playPosRef.current + (dt * playbackSpeedRef.current) / totalLapTimeRef.current;
        const sRange  = activeSectorRangeRef.current;
        const sBnd    = sRange ? sRange.start : 0;
        const eBnd    = sRange ? sRange.end   : 1;
        if (newPos >= eBnd) {
          if (sRange) {
            // Loop back to sector start
            scrubByPct(sBnd);
            tracesRef.current?.syncHover(sBnd * maxDistRef.current);
            deltaChartRef.current?.syncHover(sBnd * maxDistRef.current);
            playLastTimeRef.current = now;
            playRafRef.current = requestAnimationFrame(tick);
            return;
          }
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


  const sectorClickProps = {
    onSectorClick: (i: number, start: number, end: number, md: number) => {
      activeSectorRangeRef.current = { start, end };
      setActiveSectorIdx(i);
      splitsPanelRef.current?.setActiveSector(i);
      scrubByPct(start);
      trackMapRef.current?.zoomToSector(start, end);
      const startDist = start * md;
      tracesRef.current?.setXRange(startDist, end * md);
      tracesRef.current?.syncHover(startDist);
      deltaChartRef.current?.syncHover(startDist);
    },
    onFullLap: () => {
      activeSectorRangeRef.current = null;
      setActiveSectorIdx(null);
      splitsPanelRef.current?.setActiveSector(null);
      trackMapRef.current?.resetZoom();
      tracesRef.current?.resetXRange();
    },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

    {/* ── Main row ──────────────────────────────────────────────────────────── */}
    <div className="relative flex flex-1 overflow-hidden min-h-0">

      {/* ── Center: track map + HUD + delta ───────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0 min-w-0">

        {/* Track map */}
        <div className="relative flex-1 overflow-hidden">

          {/* Zoom lupe — bottom-left */}
          <div ref={zoomPanelRef} className="absolute bottom-2 left-2 z-20 flex flex-col items-center gap-1 select-none">
            {zoomOpen && (
              <div
                className="flex flex-col items-center gap-2 rounded-lg px-3 py-3 w-12"
                style={{ backgroundColor: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {followZoom}×
                </span>
                <input
                  type="range" min={2} max={30} step={0.5}
                  value={followZoom}
                  style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 120, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    setFollowZoom(z);
                    localStorage.setItem('drivingFollowZoom', String(z));
                    trackMapRef.current?.setFollowZoom(z);
                  }}
                />
              </div>
            )}
            <button
              type="button"
              title={`Follow zoom: ${followZoom}×`}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)', color: zoomOpen ? 'var(--color-accent)' : 'var(--color-muted)' }}
              onMouseDown={(e) => { e.stopPropagation(); setZoomOpen((v) => !v); }}
            >
              <MagnifyingGlassPlusIcon className="w-4 h-4" />
            </button>
          </div>

          <TrackMap
            ref={trackMapRef}
            session={session}
            trackLaps={trackLaps}
            deltaData={deltaData}
            telemetryRef={hudRef}
            boundaries={boundaries}
          />

          {/* Splits overlay — top-right */}
          <div className="absolute top-2 right-2 z-20 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)', minWidth: 260 }}>
            <SplitsPanel ref={splitsPanelRef} {...sectorClickProps} />
          </div>
        </div>

        {/* HUD */}
        <div className="shrink-0 border-t border-border bg-surface select-none">
          <DrivingHUD ref={drivingHudRef} />
        </div>

        {/* Delta chart */}
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

      {/* ── Right sidebar: traces (animated) ─────────────────────────────── */}
      <div
        className="shrink-0 overflow-hidden flex flex-col min-h-0"
        style={{
          width: tracesCollapsed ? 0 : tracesWidth,
          borderLeft: tracesCollapsed ? 'none' : '1px solid var(--color-border)',
          transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Inner fixed-width container so content doesn't reflow during animation */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0" style={{ width: tracesWidth }}>
          {/* Traces */}
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
              onFullLap={sectorClickProps.onFullLap}
            />
          </div>
        </div>
      </div>

      {/* Toggle tab — floats at the boundary, centered vertically */}
      <button
        type="button"
        title={tracesCollapsed ? 'Show traces' : 'Hide traces'}
        className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer group"
        style={{
          right: tracesCollapsed ? 0 : tracesWidth,
          transition: 'right 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={() => setTracesCollapsed((v) => !v)}
      >
        <div
          className="w-4 h-10 flex items-center justify-center rounded-l-md bg-surface-2 border border-r-0 border-border group-hover:border-accent/40 group-hover:bg-surface transition-colors"
        >
          {tracesCollapsed
            ? <ChevronLeftIcon className="w-3 h-3 text-muted group-hover:text-text transition-colors" />
            : <ChevronRightIcon className="w-3 h-3 text-muted group-hover:text-text transition-colors" />}
        </div>
      </button>

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
