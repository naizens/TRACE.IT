# CLAUDE.md — TRACE.IT Telemetry Tool

## Project Overview
iRacing telemetry analysis desktop app — **Electron + electron-vite + React + Tailwind V4 + TypeScript**.
IBT binary files are parsed in the Electron **main process** (Node.js) and sent to the renderer via IPC. No JSON file I/O — everything is in-memory.

---

## Tech Stack
| | |
|---|---|
| Runtime | Electron 33 + electron-vite 2 |
| UI | React 18 + TypeScript 5 |
| Styling | **Tailwind CSS v4** — CSS-first, `@tailwindcss/vite` plugin, **no tailwind.config file** |
| State | **Zustand 5** |
| Charts | Chart.js 4 + react-chartjs-2 5 + chartjs-plugin-zoom 2 + hammerjs |
| Updates | **electron-updater** — GitHub Releases, background download, notify-then-restart UX |

---

## Dev Commands
```bash
npm run dev       # electron-vite dev server (hot-reload renderer + Electron)
npm run build     # compile to out/
npm run dist      # build + package installer → release/
npm run typecheck # tsc --noEmit
```

### Release workflow

**Every release requires updating 3 files before committing:**

| File | What to change |
|------|----------------|
| `package.json` | `"version"` field → new version string |
| `src/renderer/src/components/layout/TitleBar.tsx` | Hardcoded badge text `v0.0.X` (line with `v0.0.X` inside the changelog button) |
| `src/renderer/src/components/ui/ChangelogModal.tsx` | Prepend a new entry to the `CHANGELOG` array |

**ChangelogModal entry format:**
```ts
{
  version: 'X.Y.Z',
  date: 'YYYY-MM-DD',
  changes: [
    { type: 'feat',     text: 'Description of new feature' },
    { type: 'perf',     text: 'Description of performance improvement' },
    { type: 'fix',      text: 'Description of bug fix' },
    { type: 'refactor', text: 'Description of internal improvement' },
  ],
},
```

**Then commit, tag, and push:**
```bash
git add package.json src/renderer/src/components/layout/TitleBar.tsx src/renderer/src/components/ui/ChangelogModal.tsx [... other changed files]
git commit -m "feat: <summary> and bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
# GitHub Actions builds Windows + macOS installers and publishes to GitHub Releases
```

---

## Folder Structure
```
src/
  main/
    index.ts           — Electron main process: window creation, auto-updater, window controls IPC, IBT file dialog, drag-drop parsing
    ibt-parser.ts      — Binary IBT parser, returns ParsedSession
  preload/
    index.ts           — contextBridge: exposes window.electronAPI (IBT parse, updates, window controls)
  renderer/src/
    App.tsx            — root, tab routing, renders TitleBar + Sidebar + active feature view + DropZone + UpdateBanner
    main.tsx, index.css, env.d.ts
    types/session.ts   — ParsedSession, LapInfo, SessionMeta, LapColor, LapSelections
    store/useStore.ts  — Zustand store: sessions[], selections{}, activeTab; lap colour toggling with slot constraints
    lib/
      constants.ts       — LAP_COLORS, COLOR_ORDER, CHART_CONFIGS
      interpolate.ts     — binary-search linear interpolation
      formatters.ts      — formatLapTime, formatDelta, arrayMax, arrayMin, darken(hex, amount)
      chartSetup.ts      — Chart.js global register + SyncCursor plugin + pinnedCursor state
      buildChartData.ts  — shared chart dataset builder (Telemetry, TireTemp, etc.)
      syncChartConfig.ts — buildZoomPlugin, buildClickHandler
    components/
      ui/Button.tsx
      ui/UpdateBanner.tsx   — update-ready toast (fixed top-right, below title bar)
      ui/ChangelogModal.tsx — release history modal, opened from TitleBar version badge
      layout/TitleBar.tsx   — frameless title bar: logo, tab nav, version badge, window controls
      layout/Sidebar.tsx    — left panel: open button, SessionList, LapList, TelemetryBar + TrackMap
      layout/DropZone.tsx   — full-screen drag-and-drop overlay (shown when no sessions loaded)
    hooks/
      useChartSync.ts       — imperative chart hover/zoom/click/drag sync, zero re-renders
      useTrackMapUpdate.ts  — reads Zustand imperatively, calls trackMapRef.updateMarker with correct lap's telemetry
    features/
      sessions/        — SessionList.tsx, LapList.tsx (lap selector, hover tooltip with temps/humidity/fuel)
      telemetry/       — TelemetryView.tsx, ChartPanel.tsx, createChartOptions.ts
      rideheight/      — RideHeightView.tsx (Splitter / Front / Rear panels)
      tiretemp/        — TireTempView.tsx (2×2 grid, 3 positions per corner)
      damper/          — DamperView.tsx (shock velocity histograms, LS/HS zones)
      shocks/          — ShocksView.tsx (shock deflection charts + bump-rubber gap line)
      setup/           — SetupView.tsx (multi-session CarSetup diff table)
      trackmap/        — TrackMap.tsx, TelemetryBar.tsx, index.ts (barrel — always import from here)
```

---

## Key Architecture Decisions

### IBT Parser (main process)
- Runs in `src/main/ibt-parser.ts` — Node.js only, never imported by renderer
- IPC channel: `open-ibt-files` → returns `ParsedSession[]`
- Only channels in `NEEDED_VARS` Set are extracted; adding new channels = add to that Set

### IBT Header Offsets (verified)
| Field | Offset |
|-------|--------|
| tickRate | 8 |
| sessionInfoLen | 16 |
| sessionInfoOffset | 20 |
| numVars | 24 |
| varHeaderOffset | 28 |
| bufLen | 36 |
| varBuf[0].bufOffset | 52 |
| numSamples | 140 |

Variable descriptor: 144 bytes — type@+0, offset@+4, count@+8, name@+16 (char[32], ASCII, null-terminated).

### Session YAML (embedded in IBT)
- iRacing's YAML uses non-standard `;` inline comments — **do not use `yaml.load` for simple scalar fields**, use regex instead
- `CarSetup:` block is safe to parse with `yaml.load` (no `;` comments there)
- Humidity lives in the YAML under `RelativeHumidity:` — extracted via regex, stored in `meta.humidity_pct`
- Pattern: `str.match(/RelativeHumidity:\s*(\d+(?:\.\d+)?)/)`

### Chart Sync (zero re-renders)
- Sync is fully **imperative** — direct Chart.js API calls on hover/zoom, no React state updates
- Chart options created once via `useMemo([])` — hover/zoom callbacks read values from **mutable refs** to avoid stale closures
- SyncCursor plugin registered globally in `lib/chartSetup.ts`

### Track Map
- Canvas-based, dead reckoning: `x += Speed * cos(Yaw) * dt`, `y += Speed * sin(Yaw) * dt`
- Exposes imperative `updateMarker(lapDist, inputs?)` via `forwardRef` / `useImperativeHandle`
- `TelemetryBar` is a **separate component** above the map canvas — do not merge back into the canvas
- Always import from the barrel: `import { TrackMap, TelemetryBar } from '../trackmap'` (the `index.ts`)
- Use `useTrackMapUpdate(trackMapRef)` in every view that has a map ref — reads the highest-priority selected lap from Zustand and calls `updateMarker` with correct telemetry

### Multiple Sessions
- `sessions[0]` = primary session (green indicator)
- Telemetry and track map use only `sessions[0]`; Setup tab compares all sessions

### Auto-Updater
- `electron-updater` downloads updates silently in the background (packaged builds only — gated on `app.isPackaged`)
- Main process emits `update:downloaded` IPC event → renderer shows `<UpdateBanner />` toast
- User clicks "Restart now" → renderer sends `update:install` → `autoUpdater.quitAndInstall()`
- Publish target configured in `package.json` `build.publish` — **fill in `owner`/`repo` before first release**
- CI: `.github/workflows/release.yml` triggers on `v*` tags; builds Windows + macOS; uses `GITHUB_TOKEN` (auto-injected)
- **macOS auto-update requires code signing + notarization** — updater will fail silently without it

---

## Tailwind V4 Custom Tokens
Defined in `src/renderer/src/index.css`:

| CSS Variable | Tailwind Class |
|---|---|
| `--color-bg` | `bg-bg` |
| `--color-surface` | `bg-surface` |
| `--color-surface-2` | `bg-surface-2` |
| `--color-border` | `border-border` |
| `--color-muted` | `text-muted` |
| `--color-text` | `text-text` |
| `--color-accent` | `text-accent` / `bg-accent` |

Use canonical Tailwind V4 class names — e.g. `shrink-0` not `flex-shrink-0`.

---

## Available IBT Channels (confirmed from real file)

### Currently Extracted (NEEDED_VARS)
`SessionTime`, `Lap`, `LapDist`, `Throttle`, `Brake`, `SteeringWheelAngle`, `Speed`, `LapLastLapTime`, `Gear`, `RPM`, `FuelLevel`, `DcBrakeBias`, `LFpressure`, `RFpressure`, `LRpressure`, `RRpressure`, `LFtempL/M/R`, `RFtempL/M/R`, `LRtempL/M/R`, `RRtempL/M/R`, `LFrideHeight`, `RFrideHeight`, `LRrideHeight`, `RRrideHeight`, `Yaw`, `LFshockVel`, `RFshockVel`, `LRshockVel`, `RRshockVel`, `LFshockDefl`, `RFshockDefl`, `LRshockDefl`, `RRshockDefl`, `AirTemp`, `TrackTemp`

### Notable Available (not yet extracted)
- **G-forces:** `LatAccel`, `LongAccel`, `VertAccel`
- **Motion:** `VelocityX/Y/Z`, `Pitch`, `Roll`, `PitchRate`, `RollRate`, `YawRate`
- **Tire wear:** `LFwearL/M/R`, `RFwearL/M/R`, `LRwearL/M/R`, `RRwearL/M/R`
- **Tire center temps:** `LFtempCL/CM/CR`, `RFtempCL/CM/CR`, `LRtempCL/CM/CR`, `RRtempCL/CM/CR`
- **Wheel speeds:** `LFspeed`, `RFspeed`, `LRspeed`, `RRspeed`
- **Brake pressure:** `LFbrakeLinePress`, `RFbrakeLinePress`, `LRbrakeLinePress`, `RRbrakeLinePress`
- **Engine:** `OilTemp`, `WaterTemp`, `FuelUsePerHour`, `FuelLevelPct`, `ManifoldPress`
- **Lap delta:** `LapCurrentLapTime`, `LapDeltaToBestLap`, `LapDeltaToOptimalLap`
- **Weather:** `RelativeHumidity`, `TrackTempCrew`, `TrackWetness`, `WindDir`, `WindVel`
- **State:** `OnPitRoad`, `BrakeABSactive`, `PlayerCarPosition`

Full list in `docs/ibt-channels.md` — regenerate with `IBT_DEBUG_CHANNELS=1`.

---

## Critical Gotchas
- **Never use `Math.min(...largeArray)`** — stack overflow on 7000+ elements. Use a loop.
- `buffer.slice()` is deprecated — prefer `buffer.subarray()` in new code.
- The sidebar (`Sidebar.tsx`) has `overflow-hidden` — tooltips that escape it must use `position: fixed`.
- `js-yaml` lacks type declarations — existing `@ts-ignore` / cast pattern is intentional.
- **TitleBar version badge is hardcoded** — `TitleBar.tsx` line with the version string (e.g. `v0.1.0`) must be updated manually (or via `/release`); it does NOT read from `package.json`.
- **`/release X.Y.Z`** — use this skill to automate all 3-file version bumps + commit + tag + push.
- **Circular imports** — if two co-located components share a type, own it in the component that *accepts* it as input; the other imports and re-exports it.
