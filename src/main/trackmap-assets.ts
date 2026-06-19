/**
 * Track map asset downloader — main process only.
 * Uses a public CDN (members-assets.iracing.com) — no iRacing auth required.
 *
 * Flow:
 *  1. Fetch metadata JSON (cached locally for 7 days)
 *  2. Given a track_id, look up the background.svg URL
 *  3. Download + cache the SVG to userData/trackmap-cache/<id>.svg
 *  4. Return the local path to the renderer
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const METADATA_URL = 'https://raw.githubusercontent.com/meowmachine/racing-track-maps-vector/main/from-iracing/iracing-tracks-metadata.json';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TrackConfig {
  track_id: number;
  svg_urls: {
    background: string;
    active: string;
    inactive: string;
    pitroad: string;
    'start-finish': string;
    turns: string;
  };
}

interface TrackEntry {
  track_id: number;
  configurations: TrackConfig[];
}

interface Metadata {
  tracks: TrackEntry[];
}

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'trackmap-cache');
}

function metadataPath(): string {
  return path.join(cacheDir(), '_metadata.json');
}

function svgPath(trackId: number, layer: 'background' | 'active'): string {
  return path.join(cacheDir(), `${trackId}-${layer}.svg`);
}

function ensureCacheDir() {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Metadata ──────────────────────────────────────────────────────────────────

let _metadataCache: Metadata | null = null;

async function loadMetadata(): Promise<Metadata | null> {
  if (_metadataCache) return _metadataCache;

  ensureCacheDir();
  const mp = metadataPath();

  // Use local cache if fresh enough
  if (fs.existsSync(mp)) {
    try {
      const stat = fs.statSync(mp);
      if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
        const raw = fs.readFileSync(mp, 'utf-8').replace(/^﻿/, '');
        _metadataCache = JSON.parse(raw) as Metadata;
        return _metadataCache;
      }
    } catch { /* fall through to re-download */ }
  }

  // Download fresh copy
  try {
    const res = await fetch(METADATA_URL);
    if (!res.ok) return null;
    const text = (await res.text()).replace(/^﻿/, '');
    fs.writeFileSync(mp, text, 'utf-8');
    _metadataCache = JSON.parse(text) as Metadata;
    return _metadataCache;
  } catch (e) {
    console.error('[trackmap-assets] metadata fetch failed:', (e as Error).message);
    return null;
  }
}

function findConfig(meta: Metadata, trackId: number): TrackConfig | null {
  for (const track of meta.tracks) {
    for (const cfg of track.configurations) {
      if (cfg.track_id === trackId) return cfg;
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

async function fetchSvgLayer(
  cfg: TrackConfig,
  layer: 'background' | 'active',
  trackId: number,
): Promise<string | null> {
  const sp = svgPath(trackId, layer);
  if (fs.existsSync(sp)) return fs.readFileSync(sp, 'utf-8');
  try {
    const res = await fetch(cfg.svg_urls[layer]);
    if (!res.ok) return null;
    const text = await res.text();
    ensureCacheDir();
    fs.writeFileSync(sp, text, 'utf-8');
    return text;
  } catch (e) {
    console.error(`[trackmap-assets] ${layer} SVG download failed:`, (e as Error).message);
    return null;
  }
}

/** Returns background + active SVG content strings (downloads + caches on first call). */
export async function getTrackMapSvgs(trackId: number): Promise<{ background: string | null; active: string | null }> {
  const meta = await loadMetadata();
  if (!meta) return { background: null, active: null };

  const cfg = findConfig(meta, trackId);
  if (!cfg) {
    console.warn(`[trackmap-assets] no config found for track_id=${trackId}`);
    return { background: null, active: null };
  }

  const [background, active] = await Promise.all([
    fetchSvgLayer(cfg, 'background', trackId),
    fetchSvgLayer(cfg, 'active', trackId),
  ]);

  return { background, active };
}

/** Pre-warm: download metadata in the background on startup. */
export function prefetchMetadata(): void {
  loadMetadata().catch(() => {});
}
