import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { RefObject } from 'react';
import type { ParsedSession } from '../../types/session';
import type { TelemetryBarHandle, TelemetryInputs } from './TelemetryBar';
import { buildTrack, DEG_TO_RAD, type GpsOrigin, type TrackData } from './trackMapGeometry';
import { interpolate } from '../../lib/interpolate';


export interface DeltaData {
  refDist: ArrayLike<number>;
  refTime: ArrayLike<number>;
  cmpDist: ArrayLike<number>;
  cmpTime: ArrayLike<number>;
}

// rate = seconds per meter — saturates at ±0.001 s/m (≈ 5 s/lap over 5000 m)
const DELTA_RATE_RANGE = 0.001;
function deltaRateToCss(rate: number): string {
  const t = Math.max(-1, Math.min(1, rate / DELTA_RATE_RANGE));
  if (t <= 0) {
    const f = -t;
    // white → green (#22c55e)
    return `rgb(${Math.round(255 - 221 * f)},${Math.round(255 - 58 * f)},${Math.round(255 - 161 * f)})`;
  }
  const f = t;
  // white → red (#ef4444)
  return `rgb(${Math.round(255 - 16 * f)},${Math.round(255 - 187 * f)},${Math.round(255 - 187 * f)})`;
}

export type { TelemetryInputs };

export interface TrackMapHandle {
  updateMarker:  (lapDist: number, inputs?: TelemetryInputs[]) => void;
  zoomToSector:  (startPct: number, endPct: number) => void;
  resetZoom:     () => void;
}

export interface LapEntry {
  session: ParsedSession;
  lapIdx:  number;
  color:   string;
}

interface View {
  scale:   number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  session:       ParsedSession | null;
  telemetryRef?: RefObject<TelemetryBarHandle | null>;
  trackLaps?:    LapEntry[];
  deltaData?:    DeltaData;
}

export const TrackMap = forwardRef<TrackMapHandle, Props>(({ session, telemetryRef, trackLaps, deltaData }, ref) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const tracksRef      = useRef<TrackData[]>([]);
  const markerRef      = useRef<number | undefined>(undefined);
  const viewRef        = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const deltaColorsRef = useRef<string[] | null>(null);
  const animFrameRef   = useRef<number | null>(null);
  // Offscreen cache — static layer (bg + track + driving lines) is pre-rendered
  // and only rebuilt when tracks/delta/view/size change, not on every marker update.
  const offscreenRef   = useRef<HTMLCanvasElement | null>(null);
  const staticDirtyRef = useRef(true);
  const bgColorRef     = useRef('');
  const bboxRef        = useRef<{ minX: number; maxX: number; minY: number; maxY: number } | null>(null);


  // ── Build tracks (GPS or dead-reckoning fallback) ─────────────────────────
  useEffect(() => {
    tracksRef.current      = [];
    deltaColorsRef.current = null;
    markerRef.current      = undefined;
    // Mutate in place — the zoom useEffect holds a reference to this same object
    viewRef.current.scale   = 1;
    viewRef.current.offsetX = 0;
    viewRef.current.offsetY = 0;

    const builds: TrackData[] = [];

    // Derive a shared GPS origin from the first available session so all laps
    // — even across different sessions — live in the same coordinate grid.
    // (GPS coords on the same track are identical across sessions, so they
    // align automatically once they share a reference point.)
    let gpsOrigin: GpsOrigin | undefined;
    const firstSrc = (trackLaps && trackLaps.length > 0)
      ? trackLaps[0].session
      : session;
    if (firstSrc?.data['Lat']?.length && firstSrc?.data['Lon']?.length) {
      const lat0Rad = firstSrc.data['Lat'][0] * DEG_TO_RAD;
      gpsOrigin = { lat0Rad, lon0: firstSrc.data['Lon'][0], cosLat0: Math.cos(lat0Rad) };
    }

    if (trackLaps && trackLaps.length > 0) {
      for (const { session: src, lapIdx, color } of trackLaps) {
        const lap = src.laps[lapIdx];
        if (!lap) continue;
        const track = buildTrack(src, lap, color, gpsOrigin);
        if (track) builds.push(track);
      }
    }

    // Fallback: no selections — auto-pick the best lap from session[0]
    if (builds.length === 0 && session) {
      const dist = session.data['LapDist'];
      const lap =
        session.laps.find((l) => l.lap_time_s > 0 && (dist?.[l.start_idx] ?? 999) < 100) ??
        session.laps.find((l) => l.lap_time_s > 0) ??
        session.laps[0];
      if (lap) {
        const track = buildTrack(session, lap, '#3f3f46', gpsOrigin);
        if (track) builds.push(track);
      }
    }

    tracksRef.current = builds;

    // Recompute bounding box once (used by redraw every frame)
    if (builds.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const t of builds) {
        for (let i = 0; i < t.xs.length; i++) {
          if (t.xs[i] < minX) minX = t.xs[i]; else if (t.xs[i] > maxX) maxX = t.xs[i];
          if (t.ys[i] < minY) minY = t.ys[i]; else if (t.ys[i] > maxY) maxY = t.ys[i];
        }
      }
      bboxRef.current = { minX, maxX, minY, maxY };
    } else {
      bboxRef.current = null;
    }
    staticDirtyRef.current = true;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, trackLaps]);

  // ── Precompute per-point delta colors when deltaData changes ─────────────
  useEffect(() => {
    const track = tracksRef.current[0];
    if (!deltaData || !track) {
      if (deltaColorsRef.current) { deltaColorsRef.current = null; staticDirtyRef.current = true; redraw(); }
      return;
    }
    // Compute cumulative delta at each track point first
    const deltas = new Float64Array(track.dists.length);
    for (let i = 0; i < track.dists.length; i++) {
      const d = track.dists[i];
      deltas[i] = interpolate(deltaData.cmpDist, deltaData.cmpTime, d)
                - interpolate(deltaData.refDist, deltaData.refTime, d);
    }
    // Color by LOCAL rate (d(delta)/d(dist)) — shows WHERE time is gained/lost,
    // not cumulative gap (which stays red once behind)
    const colors: string[] = new Array(track.dists.length);
    for (let i = 0; i < track.dists.length; i++) {
      const dDist = i < track.dists.length - 1
        ? (track.dists[i + 1] - track.dists[i]) || 1
        : (track.dists[i] - track.dists[i - 1]) || 1;
      const dDelta = i < track.dists.length - 1
        ? deltas[i + 1] - deltas[i]
        : deltas[i] - deltas[i - 1];
      colors[i] = deltaRateToCss(dDelta / dDist);
    }
    deltaColorsRef.current = colors;
    staticDirtyRef.current = true;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deltaData, session, trackLaps]);

  // ── Canvas drawing ────────────────────────────────────────────────────────
  const redraw = useCallback((markerDist?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const W = parent.clientWidth  || 185;
    const H = parent.clientHeight || 400;
    if (W < 2 || H < 2) return;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
      staticDirtyRef.current = true;
    }

    const ctx    = canvas.getContext('2d')!;
    const tracks = tracksRef.current;
    const bbox   = bboxRef.current;

    // Derive coordinate transform (cheap — just arithmetic from cached bbox)
    const { scale: zoom, offsetX, offsetY } = viewRef.current;
    let px: (v: number) => number = () => 0;
    let py: (v: number) => number = () => 0;
    if (bbox) {
      const pad       = 16;
      const trackW    = (bbox.maxX - bbox.minX) || 1;
      const trackH    = (bbox.maxY - bbox.minY) || 1;
      const baseScale = Math.min((W - pad * 2) / trackW, (H - pad * 2) / trackH);
      const offX      = (W - trackW * baseScale) / 2;
      const offY      = (H - trackH * baseScale) / 2;
      const { minX, minY } = bbox;
      px = (v: number) => offX + (v - minX) * baseScale;
      py = (v: number) => H - offY - (v - minY) * baseScale;
    }

    // ── Rebuild offscreen static layer only when dirty ────────────────────────
    if (staticDirtyRef.current || !offscreenRef.current) {
      let os = offscreenRef.current;
      if (!os) { os = document.createElement('canvas'); offscreenRef.current = os; }
      os.width  = W;
      os.height = H;
      staticDirtyRef.current = false;

      const oc = os.getContext('2d')!;

      if (!bgColorRef.current) {
        bgColorRef.current = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-surface-2').trim() || '#1c1c1f';
      }
      oc.fillStyle = bgColorRef.current;
      oc.fillRect(0, 0, W, H);

      if (tracks.length && bbox) {
        oc.save();
        oc.translate(offsetX, offsetY);
        oc.scale(zoom, zoom);

        const strokeSmooth = (xs: number[], ys: number[]) => {
          const len = xs.length;
          if (len < 2) return;
          oc.beginPath();
          oc.moveTo((px(xs[0]) + px(xs[1])) / 2, (py(ys[0]) + py(ys[1])) / 2);
          for (let i = 1; i < len - 1; i++) {
            oc.quadraticCurveTo(
              px(xs[i]), py(ys[i]),
              (px(xs[i]) + px(xs[i + 1])) / 2,
              (py(ys[i]) + py(ys[i + 1])) / 2,
            );
          }
          oc.lineTo(px(xs[len - 1]), py(ys[len - 1]));
        };

        for (const t of tracks) {
          strokeSmooth(t.xs, t.ys);
          oc.lineWidth   = 8 / zoom;
          oc.strokeStyle = 'rgba(0,0,0,0.5)';
          oc.stroke();
        }

        const dc = deltaColorsRef.current;
        if (dc && tracks[0]) {
          const { xs, ys } = tracks[0];
          const len = xs.length;
          oc.lineWidth = 2 / zoom;
          let i = 0;
          while (i < len - 1) {
            const color = dc[i] ?? '#ffffff';
            oc.beginPath();
            oc.moveTo(
              i === 0 ? px(xs[0]) : (px(xs[i - 1]) + px(xs[i])) / 2,
              i === 0 ? py(ys[0]) : (py(ys[i - 1]) + py(ys[i])) / 2,
            );
            let j = i;
            while (j < len - 1 && dc[j] === color) {
              oc.lineTo((px(xs[j]) + px(xs[j + 1])) / 2, (py(ys[j]) + py(ys[j + 1])) / 2);
              j++;
            }
            oc.strokeStyle = color;
            oc.stroke();
            i = j;
          }
        } else {
          for (const t of tracks) {
            strokeSmooth(t.xs, t.ys);
            oc.lineWidth   = 1.5 / zoom;
            oc.strokeStyle = t.color;
            oc.stroke();
          }
        }

        oc.restore();
      }
    }

    // Blit static layer — O(1) GPU copy
    ctx.drawImage(offscreenRef.current!, 0, 0);

    if (!tracks.length || !bbox) return;

    // ── Position markers (dynamic — drawn on top every frame) ─────────────────
    const md = markerDist ?? markerRef.current;
    if (md !== undefined) {
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, zoom);
      for (const t of tracks) {
        let lo = 0, hi = t.dists.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (t.dists[m] < md) lo = m + 1; else hi = m;
        }
        ctx.beginPath();
        ctx.arc(px(t.xs[lo]), py(t.ys[lo]), 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle   = t.color;
        ctx.fill();
        ctx.lineWidth   = 2 / zoom;
        ctx.strokeStyle = '#000';
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  // ── Zoom & pan interactions ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const view = viewRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect   = canvas.getBoundingClientRect();
      const mx     = e.clientX - rect.left;
      const my     = e.clientY - rect.top;
      const step   = e.ctrlKey ? 1.05 : 1.3;
      const factor = e.deltaY < 0 ? step : 1 / step;
      // Zoom centred on cursor: keep the point under the cursor fixed
      view.offsetX = mx - (mx - view.offsetX) * factor;
      view.offsetY = my - (my - view.offsetY) * factor;
      view.scale  *= factor;
      staticDirtyRef.current = true;
      redraw(markerRef.current);
    };

    let dragging = false;
    let lastX = 0, lastY = 0;

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      view.offsetX += e.clientX - lastX;
      view.offsetY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      staticDirtyRef.current = true;
      redraw(markerRef.current);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = 'grab';
    };

    const onDblClick = () => {
      view.scale   = 1;
      view.offsetX = 0;
      view.offsetY = 0;
      staticDirtyRef.current = true;
      redraw(markerRef.current);
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel',     onWheel,    { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('dblclick',  onDblClick);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      canvas.removeEventListener('wheel',     onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('dblclick',  onDblClick);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [redraw]);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => redraw(markerRef.current));
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [redraw]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    updateMarker(lapDist: number, inputs?: TelemetryInputs[]) {
      markerRef.current = lapDist;
      redraw(lapDist);

      if (inputs && inputs.length > 0) {
        telemetryRef?.current?.update(inputs);
      } else {
        const track = tracksRef.current[0];
        if (!track) return;

        let lo = 0, hi = track.dists.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (track.dists[m] < lapDist) lo = m + 1; else hi = m;
        }
        const idx = track.startIdx + lo;
        const d   = track.session.data;

        telemetryRef?.current?.update([{
          throttle: Math.round((d['Throttle']?.[idx] ?? 0) * 100),
          brake:    Math.round((d['Brake']?.[idx]    ?? 0) * 100),
          gear:     d['Gear']?.[idx] ?? 0,
          speedKph: Math.round((d['Speed']?.[idx]    ?? 0) * 3.6),
          steerDeg: d['SteeringWheelAngle']?.[idx]   ?? 0,
        }]);
      }
    },

    zoomToSector(startPct: number, endPct: number) {
      const canvas = canvasRef.current;
      const tracks = tracksRef.current;
      if (!canvas || !tracks.length) return;

      const W = canvas.width || canvas.clientWidth;
      const H = canvas.height || canvas.clientHeight;
      const pad = 16;

      // Recompute the base fit-to-canvas transform (same as redraw)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const t of tracks) {
        for (let i = 0; i < t.xs.length; i++) {
          if (t.xs[i] < minX) minX = t.xs[i];
          if (t.xs[i] > maxX) maxX = t.xs[i];
          if (t.ys[i] < minY) minY = t.ys[i];
          if (t.ys[i] > maxY) maxY = t.ys[i];
        }
      }
      const bTrackW   = (maxX - minX) || 1;
      const bTrackH   = (maxY - minY) || 1;
      const baseScale = Math.min((W - pad * 2) / bTrackW, (H - pad * 2) / bTrackH);
      const bOffX     = (W - bTrackW * baseScale) / 2;
      const bOffY     = (H - bTrackH * baseScale) / 2;
      const toPx = (v: number) => bOffX + (v - minX) * baseScale;
      const toPy = (v: number) => H - bOffY - (v - minY) * baseScale;

      // Collect canvas-space points belonging to this sector
      let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
      for (const t of tracks) {
        const d0 = t.dists[0];
        const d1 = t.dists[t.dists.length - 1];
        const range  = d1 - d0;
        const dStart = d0 + startPct * range;
        const dEnd   = d0 + endPct   * range;
        for (let i = 0; i < t.dists.length; i++) {
          if (t.dists[i] < dStart || t.dists[i] > dEnd) continue;
          const cx = toPx(t.xs[i]);
          const cy = toPy(t.ys[i]);
          if (cx < sMinX) sMinX = cx;
          if (cx > sMaxX) sMaxX = cx;
          if (cy < sMinY) sMinY = cy;
          if (cy > sMaxY) sMaxY = cy;
        }
      }
      if (sMinX === Infinity) return;

      const sW  = sMaxX - sMinX;
      const sH  = sMaxY - sMinY;
      const targetScale   = Math.min((W - pad * 6) / (sW || 1), (H - pad * 6) / (sH || 1));
      const sCx = (sMinX + sMaxX) / 2;
      const sCy = (sMinY + sMaxY) / 2;
      const targetOffsetX = W / 2 - sCx * targetScale;
      const targetOffsetY = H / 2 - sCy * targetScale;

      // Cancel any in-progress animation
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);

      const view     = viewRef.current;
      const fromScale   = view.scale;
      const fromOffsetX = view.offsetX;
      const fromOffsetY = view.offsetY;
      const DURATION = 350;
      const start    = performance.now();

      const animate = (now: number) => {
        const raw = Math.min(1, (now - start) / DURATION);
        // ease-out cubic
        const t = 1 - (1 - raw) ** 3;
        view.scale   = fromScale   + (targetScale   - fromScale)   * t;
        view.offsetX = fromOffsetX + (targetOffsetX - fromOffsetX) * t;
        view.offsetY = fromOffsetY + (targetOffsetY - fromOffsetY) * t;
        staticDirtyRef.current = true;
        redraw(markerRef.current);
        if (raw < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    },

    resetZoom() {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      const view        = viewRef.current;
      const fromScale   = view.scale;
      const fromOffsetX = view.offsetX;
      const fromOffsetY = view.offsetY;
      const DURATION    = 350;
      const start       = performance.now();
      const animate = (now: number) => {
        const raw = Math.min(1, (now - start) / DURATION);
        const t   = 1 - (1 - raw) ** 3;
        view.scale   = fromScale   + (1 - fromScale)   * t;
        view.offsetX = fromOffsetX + (0 - fromOffsetX) * t;
        view.offsetY = fromOffsetY + (0 - fromOffsetY) * t;
        staticDirtyRef.current = true;
        redraw(markerRef.current);
        if (raw < 1) animFrameRef.current = requestAnimationFrame(animate);
        else         animFrameRef.current = null;
      };
      animFrameRef.current = requestAnimationFrame(animate);
    },
  }), [redraw, telemetryRef]);

  // ── Render ────────────────────────────────────────────────────────────────
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
});

TrackMap.displayName = 'TrackMap';
