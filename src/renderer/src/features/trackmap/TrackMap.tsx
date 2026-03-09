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
  telemetryRef?: RefObject<TelemetryBarHandle | null>;
  trackLaps?:   LapEntry[];
}

const DEG_TO_RAD = Math.PI / 180;
const EARTH_R    = 6_371_000; // metres


interface GpsOrigin { lat0Rad: number; lon0: number; cosLat0: number; }

function buildTrack(
  src: ParsedSession,
  lap: NonNullable<ParsedSession['laps'][number]>,
  color: string,
  origin?: GpsOrigin,
): TrackData | null {
  const dist = src.data['LapDist'];
  const lat  = src.data['Lat'];
  const lon  = src.data['Lon'];

  const { start_idx: s, end_idx: e } = lap;
  const xs: number[] = [], ys: number[] = [], dists: number[] = [];

  // ── GPS path (preferred) ──────────────────────────────────────────────────
  if (lat?.length && lon?.length) {
    // All laps use the same GPS origin so they share one coordinate space,
    // regardless of which session or where on track each lap starts.
    const lat0Rad0 = origin ? origin.lat0Rad : lat[0] * DEG_TO_RAD;
    const { lat0Rad, lon0, cosLat0 } = origin ?? {
      lat0Rad: lat0Rad0, lon0: lon[0], cosLat0: Math.cos(lat0Rad0),
    };

    const toX = (lo: number) => (lo - lon0) * cosLat0 * EARTH_R * DEG_TO_RAD;
    const toY = (la: number) => (la * DEG_TO_RAD - lat0Rad) * EARTH_R;

    // Collect GPS knot indices (where GPS actually updates).
    const knotIdxs: number[] = [s];
    for (let i = s + 1; i <= e; i++) {
      if (lat[i] !== lat[i - 1] || lon[i] !== lon[i - 1]) knotIdxs.push(i);
    }
    if (knotIdxs[knotIdxs.length - 1] !== e) knotIdxs.push(e);

    // Convert GPS knots to local metres.
    let kx = knotIdxs.map(i => toX(lon[i]));
    let ky = knotIdxs.map(i => toY(lat[i]));

    // Multi-pass Gaussian smooth to suppress Float32/GPS quantization noise.
    // 5 passes of [0.25, 0.5, 0.25] ≈ wide binomial kernel; first/last knot fixed.
    const kn = kx.length;
    if (kn > 4) {
      for (let pass = 0; pass < 5; pass++) {
        const skx = kx.slice(), sky = ky.slice();
        for (let i = 1; i < kn - 1; i++) {
          skx[i] = kx[i - 1] * 0.25 + kx[i] * 0.5 + kx[i + 1] * 0.25;
          sky[i] = ky[i - 1] * 0.25 + ky[i] * 0.5 + ky[i + 1] * 0.25;
        }
        kx = skx; ky = sky;
      }
    }

    for (let ki = 0; ki < knotIdxs.length; ki++) {
      xs.push(kx[ki]);
      ys.push(ky[ki]);
      dists.push(dist[knotIdxs[ki]]);
    }

    return { xs, ys, dists, startIdx: s, color, session: src };
  }

  // ── Dead-reckoning fallback (no GPS) ─────────────────────────────────────
  const yaw = src.data['Yaw'];
  const spd = src.data['Speed'];
  if (!yaw?.length || !spd?.length) return null;

  const dt   = 1 / src.meta.tick_rate_hz;
  const yaw0 = yaw[s];
  let x = 0, y = 0;
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

  // ── Build tracks (GPS or dead-reckoning fallback) ─────────────────────────
  useEffect(() => {
    tracksRef.current  = [];
    markerRef.current  = undefined;
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
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-surface-2').trim() || '#1c1c1f';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

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

    // Smooth polyline via quadratic bezier curves through midpoints.
    // Each segment curves from mid(i-1,i) → point[i] → mid(i,i+1),
    // producing a C1-continuous spline with no extra data needed.
    const strokeSmooth = (xs: number[], ys: number[]) => {
      const len = xs.length;
      if (len < 2) return;
      ctx.beginPath();
      ctx.moveTo(
        (px(xs[0]) + px(xs[1])) / 2,
        (py(ys[0]) + py(ys[1])) / 2,
      );
      for (let i = 1; i < len - 1; i++) {
        ctx.quadraticCurveTo(
          px(xs[i]), py(ys[i]),
          (px(xs[i]) + px(xs[i + 1])) / 2,
          (py(ys[i]) + py(ys[i + 1])) / 2,
        );
      }
      ctx.lineTo(px(xs[len - 1]), py(ys[len - 1]));
    };

    // ── Road surface (matches canvas background so only the driving lines show)
    for (const t of tracks) {
      strokeSmooth(t.xs, t.ys);
      ctx.lineWidth   = 8 / zoom;
      ctx.strokeStyle = bgColor;
      ctx.stroke();
    }

    // ── Coloured driving lines ─────────────────────────────────────────────
    for (const t of tracks) {
      strokeSmooth(t.xs, t.ys);
      ctx.lineWidth   = 1.5 / zoom;
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
