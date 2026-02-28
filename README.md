# TRACE.IT — iRacing Telemetry Analysis Tool

Desktop app for analysing iRacing `.ibt` telemetry files. Built with Electron, React, and Chart.js.

## Features

| Tab | Description |
|-----|-------------|
| **Telemetry** | Overlaid, synchronised charts for throttle, brake, speed, gear, steering, etc. across multiple laps/sessions |
| **Ride Height** | Per-corner ride height over lap distance |
| **Tire Temp** | Inner/mid/outer tire temperatures per corner |
| **Damper** | Shock velocity histograms per corner |
| **Setup** | Side-by-side car setup diff across loaded sessions |
| **Track Map** | Dead-reckoning canvas track map with live cursor marker |

**Sidebar** — hover any lap row to see a tooltip with air/track temp, relative humidity, and fuel consumption.

## Tech Stack

- **Electron 33** + **electron-vite 2** — unified main/preload/renderer build
- **React 18** + **TypeScript 5**
- **Tailwind CSS v4** — CSS-first, no config file
- **Zustand 5** — global state
- **Chart.js 4** + **react-chartjs-2** + **chartjs-plugin-zoom** — zoomable, pannable, synchronised charts

## Getting Started

```bash
npm install
npm run dev       # start dev server (hot-reload renderer + Electron)
```

## Build

```bash
npm run build     # compile to out/
npm run dist      # build + package installer (NSIS on Windows, DMG on macOS)
```

Packaged output goes to `release/`.

## Usage

1. Click **Open IBT Files** to load one or more `.ibt` files.
2. Select laps from the sidebar by assigning colour slots (ref / blue / pink / lime).
3. Switch tabs to compare telemetry channels, setup values, ride heights, etc.
4. Hover any lap row to see session conditions (temperature, humidity, fuel usage).

Multiple sessions can be loaded simultaneously for cross-session comparison.

## Project Structure

```
src/
  main/
    index.ts          — Electron main process, IPC handlers
    ibt-parser.ts     — Binary IBT parser (runs in Node.js)
  preload/
    index.ts          — contextBridge API exposure
  renderer/src/
    App.tsx           — root, tab routing
    types/session.ts  — ParsedSession, LapInfo, LapColor types
    store/useStore.ts — Zustand store (sessions, selections, activeTab)
    lib/
      constants.ts    — LAP_COLORS, COLOR_ORDER, CHART_CONFIGS
      interpolate.ts  — binary-search linear interpolation
      formatters.ts   — formatLapTime, arrayMax/Min
      chartSetup.ts   — Chart.js global register + SyncCursor plugin
    components/
      ui/Button.tsx
      layout/Sidebar.tsx
    features/
      sessions/       — SessionList, LapList (with hover tooltip)
      telemetry/      — TelemetryView, ChartPanel, useChartSync
      rideheight/     — RideHeightView
      tiretemp/       — TireTempView
      damper/         — DamperView
      setup/          — SetupView
      trackmap/       — TrackMap (canvas, imperative API)
```

## IBT Parser Notes

The parser (`src/main/ibt-parser.ts`) reads the binary IBT format directly in the Electron main process and returns a `ParsedSession` object via IPC — no temporary files are written.

**Key header offsets:**

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

Variable descriptor: 144 bytes — type @ +0, offset @ +4, name @ +16 (char[32], ASCII).

The session YAML embedded in each IBT file uses non-standard `;` inline comments. Simple scalar values (e.g. humidity) are extracted with regex rather than a full YAML parse.

**Debug:** set `IBT_DEBUG_CHANNELS=1` in the environment before launching to write a full channel list to `ibt-channels.md` in the project root.

## Theming

Custom CSS tokens in `src/renderer/src/index.css`:

| Token | Tailwind class |
|-------|----------------|
| `--color-bg` | `bg-bg` |
| `--color-surface` | `bg-surface` |
| `--color-surface-2` | `bg-surface-2` |
| `--color-border` | `border-border` |
| `--color-muted` | `text-muted` |
| `--color-text` | `text-text` |
| `--color-accent` | `text-accent` / `bg-accent` |
