import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { ParsedSession } from '../../types/session';

export interface TrackMapHandle {
  updateMarker: (lapDist: number) => void;
}

interface TrackData {
  xs:    number[];
  ys:    number[];
  dists: number[];
}

interface Props {
  session: ParsedSession | null;
}

export const TrackMap = forwardRef<TrackMapHandle, Props>(({ session }, ref) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const trackRef    = useRef<TrackData | null>(null);
  const markerRef   = useRef<number | undefined>(undefined);

  // ── Build dead-reckoning track from Speed + Yaw ───────────────────────────
  useEffect(() => {
    trackRef.current  = null;
    markerRef.current = undefined;

    if (!session) { redraw(); return; }

    const yaw = session.data['Yaw'];
    const spd = session.data['Speed'];
    if (!yaw?.length || !spd?.length) { redraw(); return; }

    // Use the first timed lap; fallback to first lap
    const lap = session.laps.find((l) => l.lap_time_s > 0) ?? session.laps[0];
    if (!lap) { redraw(); return; }

    const { start_idx: s, end_idx: e } = lap;
    const dist = session.data['LapDist'];
    const dt   = 1 / session.meta.tick_rate_hz;

    const xs: number[] = [];
    const ys: number[] = [];
    const dists: number[] = [];
    let x = 0, y = 0;

    for (let i = s; i <= e; i++) {
      xs.push(x);
      ys.push(y);
      dists.push(dist[i]);
      x += spd[i] * Math.cos(yaw[i]) * dt;
      y += spd[i] * Math.sin(yaw[i]) * dt;
    }

    if (isNaN(xs[xs.length - 1])) { redraw(); return; }
    trackRef.current = { xs, ys, dists };
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Canvas drawing ────────────────────────────────────────────────────────
  const redraw = useCallback((markerDist?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const W = parent.clientWidth  || 185;
    const H = parent.clientHeight || 400;
    if (W < 2 || H < 2) return;

    // Resize canvas pixel buffer if needed
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const track = trackRef.current;
    if (!track) return;

    const { xs, ys, dists } = track;

    // Bounding box — avoid spread on large arrays (stack overflow risk)
    let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i]; else if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i]; else if (ys[i] > maxY) maxY = ys[i];
    }

    const pad   = 16;
    const scale = Math.min(
      (W - pad * 2) / ((maxX - minX) || 1),
      (H - pad * 2) / ((maxY - minY) || 1),
    );
    const px = (v: number) => pad + (v - minX) * scale;
    const py = (v: number) => H - pad - (v - minY) * scale;

    // Track outline (thick dark) + surface (thinner grey)
    ctx.beginPath();
    ctx.moveTo(px(xs[0]), py(ys[0]));
    for (let i = 1; i < xs.length; i++) ctx.lineTo(px(xs[i]), py(ys[i]));
    ctx.closePath();
    ctx.lineWidth   = 12;
    ctx.strokeStyle = '#1c1c1f';
    ctx.stroke();
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#3f3f46';
    ctx.stroke();

    // Marker dot (binary search for nearest dist index)
    const md = markerDist ?? markerRef.current;
    if (md !== undefined) {
      let lo = 0, hi = dists.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (dists[m] < md) lo = m + 1; else hi = m;
      }
      ctx.beginPath();
      ctx.arc(px(xs[lo]), py(ys[lo]), 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#00ff88';
      ctx.fill();
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
  }, []);

  // ── Handle container resize via ResizeObserver ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => redraw(markerRef.current));
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [redraw]);

  // ── Imperative handle exposed to TelemetryView ────────────────────────────
  useImperativeHandle(ref, () => ({
    updateMarker(lapDist: number) {
      markerRef.current = lapDist;
      redraw(lapDist);
    },
  }), [redraw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
});

TrackMap.displayName = 'TrackMap';
