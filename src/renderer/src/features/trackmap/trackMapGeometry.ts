import type { ParsedSession } from '../../types/session';

export const DEG_TO_RAD = Math.PI / 180;
export const EARTH_R    = 6_371_000; // metres

export interface GpsOrigin {
  lat0Rad: number;
  lon0:    number;
  cosLat0: number;
}

export interface TrackData {
  xs:       number[];
  ys:       number[];
  dists:    number[];
  startIdx: number;
  color:    string;
  session:  ParsedSession;
}

export function buildTrack(
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
