# TRACE.IT — Architecture & Developer Guide

## Overview

TRACE.IT is an Electron desktop app built with **electron-vite**. The main process handles file I/O and IBT parsing; the renderer handles all UI. Communication is strictly through IPC over a typed preload bridge. No files are written to disk at runtime — everything is in-memory.

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                         │
│  src/main/index.ts       — window, IPC, auto-updater     │
│  src/main/ibt-parser.ts  — binary IBT → ParsedSession    │
├─────────────────────────────────────────────────────────┤
│  Preload (contextBridge)                                  │
│  src/preload/index.ts    — window.electronAPI            │
├─────────────────────────────────────────────────────────┤
│  Renderer (React + Vite)                                  │
│  src/renderer/src/       — all UI                        │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Runtime | Electron 40 + electron-vite 5 |
| UI | React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 — CSS-first, no config file |
| State | Zustand 5 |
| Charts | Chart.js 4 + react-chartjs-2 5 + chartjs-plugin-zoom 2 + hammerjs |
| YAML | js-yaml 4 (CarSetup block only) |
| Updates | electron-updater 6 |

---

## Process Architecture

### Main Process — `src/main/index.ts`

Frameless window (`frame: false`), with window bounds/maximized state persisted to `app.getPath('userData')/config.json`. Dev mode loads from the Vite dev server; production loads from `out/renderer/index.html`.

**IPC channels:**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `open-ibt-files` | renderer→main (handle) | File dialog → parse → `ParsedSession[]` |
| `parse-ibt-buffers` | renderer→main (handle) | Drag-drop ArrayBuffers → parse → `ParsedSession[]` |
| `window:minimize/maximize/close` | renderer→main (send) | Window controls |
| `window:is-maximized` | renderer→main (handle) | Query current state |
| `window:maximized` | main→renderer (broadcast) | State change notifications |
| `settings:get/set` | renderer→main (handle) | Read/write AppConfig |
| `settings:relaunch` | renderer→main (send) | Relaunch after config change |
| `update:downloaded` | main→renderer (broadcast) | Update ready to install |
| `update:install` | renderer→main (send) | Call `autoUpdater.quitAndInstall()` |

**Auto-updater:** gated on `app.isPackaged`. `autoDownload: true`, `autoInstallOnAppQuit: false`. Publishes to `naizens/TRACE.IT-releases` on GitHub.

**Multi-monitor handling:** before restoring window bounds, the saved center point is checked against all active displays — handles disconnected monitors gracefully.

---

### IBT Parser — `src/main/ibt-parser.ts`

Reads iRacing binary telemetry. Never imported by the renderer.

#### File format

The `.ibt` file has two parts:
- A **binary header** containing a variable descriptor table and fixed-size sample buffers.
- An **embedded YAML string** in the header containing session metadata.

#### Header offsets (verified)

| Field | Byte offset |
|-------|------------|
| tickRate | 8 |
| sessionInfoLen | 16 |
| sessionInfoOffset | 20 |
| numVars | 24 |
| varHeaderOffset | 28 |
| bufLen | 36 |
| varBuf[0].bufOffset | 52 |
| numSamples | 140 |

Each variable descriptor is **144 bytes**: `type@+0`, `offset@+4`, `count@+8`, `name@+16` (char[32], ASCII, null-terminated).

#### Channel types

| Type | Byte size | Reader |
|------|-----------|--------|
| char | 1 | — |
| bool | 1 | `readUInt8` |
| int | 4 | `readInt32LE` |
| bitfield | 4 | `readUInt32LE` |
| float | 4 | `readFloatLE` → `Float32Array` |
| double | 8 | `readDoubleLE` → `Float64Array` |

GPS channels (`Lat`, `Lon`, `YawNorth`) are stored as `Float64Array` to preserve sub-metre accuracy. All other channels use `Float32Array`.

#### Adding a new channel

1. Add the channel name to `NEEDED_VARS` (Set, lines ~63–85).
2. If it needs double precision, add to `FLOAT64_VARS`.
3. Run with `IBT_DEBUG_CHANNELS=1` to regenerate `docs/ibt-channels.md`.
4. Add the channel to `ParsedSession.data` typing in `src/renderer/src/types/session.ts`.

#### Session YAML

iRacing's embedded YAML has non-standard `;` inline comments that break standard parsers:

```yaml
BrakeSpec: "SL-6"   ; manufacturer code
```

**Rule:** use regex for all scalar fields. The `CarSetup` block is comment-free and safe to pass to `yaml.load`.

```typescript
// Correct: regex for scalar fields
str.match(/RelativeHumidity:\s*(\d+(?:\.\d+)?)/)

// Correct: yaml.load only for CarSetup
const setupYaml = rawYaml.match(/CarSetup:([\s\S]*)/)?.[1]
yaml.load(setupYaml)
```

#### Lap segmentation

1. Iterates through the `Lap` channel detecting increments (lap crossings).
2. Reads `LapLastLapTime` for the completed lap. Looks ahead up to 30 ticks — iRacing writes the time slightly after the crossing line.
3. Fallback: computes duration from sample count and tick rate.
4. Filters laps with < 10 samples (noise/incomplete).

#### ParsedSession shape

```typescript
interface ParsedSession {
  meta: {
    source_file: string;
    tick_rate_hz: number;   // typically 60
    sample_count: number;
    humidity_pct: number | null;
  };
  laps: LapInfo[];
  data: Record<string, Float32Array | Float64Array>;
  setup: Record<string, unknown>;  // CarSetup YAML block
  _filename: string;
}

interface LapInfo {
  lap: number;        // 1-indexed
  start_idx: number;
  end_idx: number;
  lap_time_s: number;
  duration_s: number;
}
```

---

### Preload Bridge — `src/preload/index.ts`

Exposes `window.electronAPI` via `contextBridge`. All event subscriptions return an unsubscribe function — callers must clean up.

```typescript
window.electronAPI = {
  openIbtFiles(): Promise<ParsedSession[] | null>
  parseIbtBuffers(files: { name: string; data: ArrayBuffer }[]): Promise<ParsedSession[] | null>
  platform: string

  updates: {
    onUpdateDownloaded(cb: () => void): () => void   // returns unsubscribe
    installNow(): void
  }

  settings: {
    get(): Promise<{ hardwareAcceleration: boolean }>
    set(updates: Partial<...>): Promise<void>
    relaunch(): void
  }

  windowControls: {
    minimize(): void
    maximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizeChange(cb: (isMax: boolean) => void): () => void  // returns unsubscribe
  }
}
```

Context isolation: **on**. Node integration: **off**. Sandbox: **false** (required for Node `fs` in the main process file dialog).

---

## Renderer Architecture

### State — `src/renderer/src/store/useStore.ts`

Zustand 5 store. No side effects — all mutations are pure.

```typescript
{
  sessions: ParsedSession[]
  selections: LapSelections          // "sessionIdx:lapIdx" → 'ref'|'blue'|'pink'|'lime'
  activeTab: Tab
  theme: 'dark' | 'light'

  addSessions(incoming): void
  removeSession(index): void         // re-keys selections after removal
  toggleLapColor(sessionIdx, lapIdx, color): void
  clearSelections(): void
  setActiveTab(tab): void
  setTheme(theme): void              // persists to localStorage
}
```

**`toggleLapColor` rules:**
- Each color slot is exclusive — assigning a color to a new lap evicts the previous owner.
- Clicking the same color on an already-selected lap deselects it.
- Max 4 laps active at once (one per color).

**`removeSession` re-keying:** selection keys are `"sessionIdx:lapIdx"`. After removal, all keys with `sessionIdx > removedIdx` are decremented by 1.

---

### Chart System

#### Global setup — `src/renderer/src/lib/chartSetup.ts`

Imported once in `main.tsx`. Registers all Chart.js components and the custom `SyncCursorPlugin`.

**SyncCursorPlugin:** draws a dashed vertical line at the pinned cursor position across all charts. Uses two hooks:
- `afterEvent`: on `mouseleave`, restore tooltip at pinned position.
- `afterDraw`: draw the vertical line from the chart's pinned `lapDist`.

**Pinned cursor state** is a module-level mutable object — not React state:

```typescript
export let pinnedCursor: { dataIndex: number; lapDist: number } | null = null
export function setPinnedCursor(v: typeof pinnedCursor) { pinnedCursor = v }
export function clearPinnedCursor() { pinnedCursor = null }
```

**DPR:** ceiling to the nearest integer — avoids blurry canvas on Windows with 1.25× or 1.5× display scaling.

#### Chart sync — `src/renderer/src/hooks/useChartSync.ts`

All hover/zoom synchronization is **imperative** — direct Chart.js API calls, zero React re-renders. Charts are registered with `register(id, instance)` and updates go to all registered peers.

```typescript
useChartSync(onMapUpdate?: (lapDist: number) => void) => {
  register(id, chart): void
  unregister(id): void
  handleHover(sourceId, dataIndex, lapDist): void
  handleZoom(sourceId, min, max): void
  handleReset(maxDist): void
  updateLimits(maxDist): void
}
```

**Key implementation details:**
- Chart instances are stored in a `ref` — not React state — so access never triggers re-renders.
- Drag-to-scrub throttled to one frame via `requestAnimationFrame`.
- `chart.update('none')` skips animation for instant updates.
- Zoom sync mutates `chart.options.scales['x']` directly.
- `clearPinnedCursor()` is called in `updateLimits()` so a stale pin doesn't persist when data changes.

#### Chart options pattern

Options are created once with `useMemo([])`. Hover/zoom callbacks capture refs, not values, to avoid stale closures:

```typescript
const syncRef = useRef(sync)   // always current sync handle
useEffect(() => { syncRef.current = sync }, [sync])

const options = useMemo(() => ({
  onHover: (e, els, chart) => syncRef.current.handleHover(...)
}), [])  // empty deps — never recreated
```

#### Dataset builder — `src/renderer/src/lib/buildChartData.ts`

Converts raw `ParsedSession.data` into Chart.js datasets.

**Resampling:** all laps are interpolated to a uniform 1-point-per-metre grid using binary-search linear interpolation (`lib/interpolate.ts`). This ensures all datasets share the same x-axis.

**Derived channels:**

- **Time delta:** `lap_time - ref_time` at each distance point. Requires a ref-slot lap.
- **Driving line diff (lateral deviation):** GPS-based signed perpendicular distance from the reference lap's path. Uses a shared GPS origin across all sessions (first lap's initial Lat/Lon). Formula: `cross(tangent, delta)` where tangent is the reference heading and delta is the coordinate offset. Positive = comparison lap to the left.

**Channel transforms:**
- Throttle/brake: `× 100` (0–1 → 0–100%)
- Speed: `× 3.6` (m/s → km/h)
- Shock deflection/velocity: `× 1000` (m → mm)
- Ride height: `× 1000` (m → mm)

---

### Track Map — `src/renderer/src/features/trackmap/`

Always import from the barrel:
```typescript
import { TrackMap, TelemetryBar } from '../trackmap'
```

#### TrackMap.tsx

Canvas-based map with imperative API:

```typescript
interface TrackMapHandle {
  updateMarker(lapDist: number, inputs?: TelemetryInputs[]): void
}
```

Called from `useTrackMapUpdate(trackMapRef)` — a hook that reads the highest-priority selected lap from Zustand and calls `updateMarker` on every chart hover.

**Track building — two paths:**

1. **GPS (preferred):** `Lat`/`Lon` → local metres via Earth radius, 5-pass Gaussian smooth to suppress quantization noise.
2. **Dead-reckoning fallback:** `x += speed × cos(yaw) × dt`, `y += speed × sin(yaw) × dt`.

**Multi-session GPS alignment:** all sessions use the same GPS reference point (first lap's initial Lat/Lon). This keeps cross-session driving lines in the same coordinate space.

**Rendering pipeline:**
1. Road surface: thick white stroke (8px / zoom).
2. Driving lines: thin coloured strokes (1.5px) via quadratic Bézier curves (C1 smooth).
3. Position markers: circles, binary-searched against `track.dists`.

**Zoom/pan:** wheel zoom centred on cursor (Ctrl+wheel for finer steps), drag to pan, double-click to reset. A `ResizeObserver` triggers a redraw on container resize.

#### TelemetryBar.tsx

Separate component above the map canvas. Displays throttle/brake bars, gear, speed, and steering for up to 2 laps. Fully imperative (`useImperativeHandle`) — zero re-renders when data updates.

---

### Lib Utilities

| File | Purpose |
|------|---------|
| `lib/constants.ts` | `LAP_COLORS`, `COLOR_ORDER`, `CHART_CONFIGS`, `getLapColor()` |
| `lib/formatters.ts` | `formatLapTime`, `formatDelta`, `arrayMax`, `arrayMin`, `darken` |
| `lib/interpolate.ts` | Binary-search linear interpolation (`interpolate(xArr, yArr, targetX)`) |
| `lib/syncChartConfig.ts` | `buildZoomPlugin`, `buildClickHandler` — shared chart option factories |

**`arrayMax` / `arrayMin`:** always use these instead of `Math.max(...arr)` — spread overflows the call stack on arrays of 7 000+ elements.

---

## Tailwind V4

No config file. Custom design tokens are CSS variables defined in `src/renderer/src/index.css`:

| CSS variable | Tailwind class |
|---|---|
| `--color-bg` | `bg-bg` |
| `--color-surface` | `bg-surface` |
| `--color-surface-2` | `bg-surface-2` |
| `--color-border` | `border-border` |
| `--color-muted` | `text-muted` |
| `--color-text` | `text-text` |
| `--color-accent` | `text-accent` / `bg-accent` |

Use canonical V4 class names: `shrink-0` not `flex-shrink-0`.

---

## Auto-Updater

Flow:
1. Main process initialises `autoUpdater` on app ready (packaged builds only).
2. Update downloads silently in background (`autoDownload: true`).
3. Main emits `update:downloaded` IPC → renderer mounts `<UpdateBanner />` toast.
4. User clicks "Restart now" → renderer sends `update:install` → `autoUpdater.quitAndInstall()`.

macOS auto-update requires code signing + notarization — will fail silently without it.

---

## Build & Release

```bash
npm run dev       # electron-vite dev server
npm run build     # compile to out/
npm run dist      # build + package → release/
npm run typecheck # tsc --noEmit
```

**electron-builder config** (in `package.json`):
- appId: `com.trace-it.app`
- Targets: Windows NSIS, macOS DMG, Linux AppImage
- asar: true
- Publish: GitHub Releases (`naizens/TRACE.IT-releases`)

**Release workflow** — three files must be updated on every release:

| File | What to change |
|------|---------------|
| `package.json` | `"version"` field |
| `src/renderer/src/components/layout/TitleBar.tsx` | Hardcoded version badge text |
| `src/renderer/src/components/ui/ChangelogModal.tsx` | Prepend new entry to `CHANGELOG` array |

Use `/release X.Y.Z` to automate this.

CI: `.github/workflows/release.yml` triggers on `v*` tags, builds Windows + macOS, publishes to GitHub Releases using `GITHUB_TOKEN` (auto-injected).

---

## Known Gotchas

- **Never `Math.min(...largeArray)`** — stack overflow on 7 000+ elements. Use `arrayMin` from `lib/formatters.ts`.
- **`buffer.slice()` is deprecated** — use `buffer.subarray()` in new code.
- **Sidebar has `overflow-hidden`** — tooltips that escape it must use `position: fixed`.
- **`js-yaml` has no type declarations** — existing `@ts-ignore` / cast pattern is intentional.
- **iRacing YAML `;` comments** — never pass raw session YAML to `yaml.load`. Regex only, except for the `CarSetup` block.
- **Lap time written after crossing** — look-ahead logic in `ibt-parser.ts` handles this; don't simplify it away.
- **Circular imports** — if two co-located components share a type, own it in the component that accepts it as input; the other imports and re-exports it.
- **TelemetryBar is separate from TrackMap canvas** — they must stay separate components; do not merge.
