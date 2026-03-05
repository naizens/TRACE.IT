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

export type { TelemetryInputs };

export interface TrackMapHandle {
  updateMarker: (lapDist: number, inputs?: TelemetryInputs[]) => void;
}

export interface LapEntry {
  session: ParsedSession;
  lapIdx:  number;
  color:   string;
}

interface TrackData {
  xs:       number[];
  ys:       number[];
  dists:    number[];
  startIdx: number;
  color:    string;
  session:  ParsedSession;
}

interface View {
  scale:   number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  session:      ParsedSession | null;
  telemetryRef?: RefObject<TelemetryBarHandle>;
  trackLaps?:   LapEntry[];
}

function buildTrack(src: ParsedSession, lap: NonNullable<ParsedSession['laps'][number]>, color: string): TrackData | null {
  const yaw  = src.data['Yaw'];
  const spd  = src.data['Speed'];
  const dist = src.data['LapDist'];
  if (!yaw?.length || !spd?.length) return null;

  const { start_idx: s, end_idx: e } = lap;
  const dt = 1 / src.meta.tick_rate_hz;
  const xs: number[] = [], ys: number[] = [], dists: number[] = [];
  let x = 0, y = 0;
  const yaw0 = yaw[s]; // normalize starting heading → all tracks overlay regardless of session

  for (let i = s; i <= e; i++) {
    xs.push(x); ys.push(y); dists.push(dist[i]);
    const relYaw = yaw[i] - yaw0;
    x += spd[i] * Math.cos(relYaw) * dt;
    y += spd[i] * Math.sin(relYaw) * dt;
  }

  if (isNaN(xs[xs.length - 1])) return null;
  return { xs, ys, dists, startIdx: s, color, session: src };
}

export const TrackMap = forwardRef<TrackMapHandle, Props>(({ session, telemetryRef, trackLaps }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracksRef = useRef<TrackData[]>([]);
  const markerRef = useRef<number | undefined>(undefined);
  const viewRef   = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });

  // ── Build dead-reckoning tracks ───────────────────────────────────────────
  useEffect(() => {
    tracksRef.current  = [];
    markerRef.current  = undefined;
    // Mutate in place — the zoom useEffect holds a reference to this same object
    viewRef.current.scale   = 1;
    viewRef.current.offsetX = 0;
    viewRef.current.offsetY = 0;

    const builds: TrackData[] = [];

    if (trackLaps && trackLaps.length > 0) {
      for (const { session: src, lapIdx, color } of trackLaps) {
        const lap = src.laps[lapIdx];
        if (!lap) continue;
        const track = buildTrack(src, lap, color);
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
        const track = buildTrack(session, lap, '#3f3f46');
        if (track) builds.push(track);
      }
    }

    tracksRef.current = builds;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, trackLaps]);

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
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const tracks = tracksRef.current;
    if (!tracks.length) return;

    // Combined bounding box — all tracks share the same canvas coordinate space
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of tracks) {
      for (let i = 0; i < t.xs.length; i++) {
        if (t.xs[i] < minX) minX = t.xs[i]; else if (t.xs[i] > maxX) maxX = t.xs[i];
        if (t.ys[i] < minY) minY = t.ys[i]; else if (t.ys[i] > maxY) maxY = t.ys[i];
      }
    }

    const pad   = 16;
    const scale = Math.min(
      (W - pad * 2) / ((maxX - minX) || 1),
      (H - pad * 2) / ((maxY - minY) || 1),
    );
    const px = (v: number) => pad + (v - minX) * scale;
    const py = (v: number) => H - pad - (v - minY) * scale;

    // Apply zoom/pan on top of the fit-to-canvas transform
    const { scale: zoom, offsetX, offsetY } = viewRef.current;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    // ── Dark road surface ──────────────────────────────────────────────────
    for (const t of tracks) {
      ctx.beginPath();
      ctx.moveTo(px(t.xs[0]), py(t.ys[0]));
      for (let i = 1; i < t.xs.length; i++) ctx.lineTo(px(t.xs[i]), py(t.ys[i]));
      ctx.closePath();
      ctx.lineWidth   = 64 / zoom;
      ctx.strokeStyle = '#1c1c1f';
      ctx.stroke();
    }

    // ── Coloured driving lines ─────────────────────────────────────────────
    for (const t of tracks) {
      ctx.beginPath();
      ctx.moveTo(px(t.xs[0]), py(t.ys[0]));
      for (let i = 1; i < t.xs.length; i++) ctx.lineTo(px(t.xs[i]), py(t.ys[i]));
      ctx.closePath();
      ctx.lineWidth   = 4 / zoom;
      ctx.strokeStyle = t.color;
      ctx.stroke();
    }

    // ── Position markers ──────────────────────────────────────────────────
    const md = markerDist ?? markerRef.current;
    if (md !== undefined) {
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
    }

    ctx.restore();
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
  }), [redraw, telemetryRef]);

  // ── Render ────────────────────────────────────────────────────────────────
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
});

TrackMap.displayName = 'TrackMap';
