/**
 * iRacing Data API client — main process only.
 * Handles auth (cookie-based), track asset fetching, and local image caching.
 *
 * Password encoding: SHA-256(password + lowercase_email) → base64
 * Auth:  POST https://members-ng.iracing.com/auth
 * Assets: GET https://members-ng.iracing.com/data/track/assets
 *          → { link } → fetch link → { [trackId]: TrackAsset }
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const BASE_URL      = 'https://members-ng.iracing.com';
const IMAGES_BASE   = 'https://images-static.iracing.com';
const CACHE_DIR     = () => path.join(app.getPath('userData'), 'trackmap-cache');

// iRacing rejects requests without a browser-like User-Agent
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// In-memory auth state (resets on app restart → user just logs in again)
let authCookies: string[] = [];
let authenticated = false;

// ── Password hashing ──────────────────────────────────────────────────────────

function hashPassword(email: string, password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + email.toLowerCase())
    .digest('base64');
}

// ── Cookie parsing ────────────────────────────────────────────────────────────

function extractCookies(headers: Headers): string[] {
  // Node 20 / undici: getSetCookie() returns string[] of individual Set-Cookie values
  const raw: string[] =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? ((headers as Headers & { getSetCookie: () => string[] }).getSetCookie())
      : (headers.get('set-cookie') ?? '').split(',').filter(Boolean);

  return raw.map((c) => c.split(';')[0].trim()).filter(Boolean);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function iRacingLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':   UA,
        'Accept':       'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin':       'https://members.iracing.com',
        'Referer':      'https://members.iracing.com/membersite/member/login.jsp',
      },
      body: JSON.stringify({ email, password: hashPassword(email, password) }),
      redirect: 'follow',
    });

    if (res.status === 429) return { ok: false, error: 'Rate limited — wait a minute and try again' };
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[iracing-api] auth failed:', res.status, res.url, body.slice(0, 200));
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { authcode: number; message?: string; inactive?: boolean };
    if (!data.authcode)     return { ok: false, error: data.message ?? 'Invalid credentials' };

    authCookies = extractCookies(res.headers);
    if (authCookies.length === 0) return { ok: false, error: 'No session cookie received' };

    authenticated = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function iRacingIsAuthenticated(): boolean {
  return authenticated;
}

export function iRacingLogout(): void {
  authCookies  = [];
  authenticated = false;
}

/** Returns the local file path to a cached track map PNG, downloading if needed. */
export async function iRacingGetTrackMap(trackId: number): Promise<string | null> {
  const cacheDir = CACHE_DIR();
  const pngPath  = path.join(cacheDir, `${trackId}.png`);

  if (fs.existsSync(pngPath)) return pngPath;
  if (!authenticated)         return null;

  try {
    // Step 1: get the signed S3 link
    const linkRes = await fetch(`${BASE_URL}/data/track/assets`, {
      headers: { Cookie: authCookies.join('; '), 'User-Agent': UA },
    });

    if (linkRes.status === 401) {
      authenticated = false;
      return null;
    }

    const { link } = (await linkRes.json()) as { link: string };

    // Step 2: fetch the full assets map
    const assetsRes  = await fetch(link);
    const assets = (await assetsRes.json()) as Record<string, { track_map?: string }>;

    const asset   = assets[String(trackId)];
    if (!asset?.track_map) return null;

    // Step 3: download the PNG
    const imgUrl = `${IMAGES_BASE}/${asset.track_map}`;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(pngPath, buf);

    return pngPath;
  } catch (e) {
    console.error('[iracing-api] getTrackMap error:', (e as Error).message);
    return null;
  }
}
