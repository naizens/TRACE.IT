// ── Changelog data ────────────────────────────────────────────────────────────

export interface Entry {
  version: string;
  date: string;
  changes: { type: 'feat' | 'perf' | 'fix' | 'refactor'; text: string }[];
}

export const CHANGELOG: Entry[] = [
  {
    version: '0.12.0',
    date: '2026-06-15',
    changes: [
      { type: 'feat',     text: 'About modal — app info, GitHub link, privacy statement, and open source credits accessible via the ⓘ button in the title bar' },
      { type: 'refactor', text: 'Releases now published directly to naizens/TRACE.IT on GitHub — auto-updater picks up new versions from the main repo' },
      { type: 'refactor', text: 'Comprehensive README with beginner guide, feature walkthrough, glossary, and FAQ' },
    ],
  },
  {
    version: '0.11.2',
    date: '2026-04-05',
    changes: [
      { type: 'feat', text: 'App icons added — custom icon now shown in Windows taskbar, title bar, and installer' },
    ],
  },
  {
    version: '0.11.1',
    date: '2026-03-11',
    changes: [
      { type: 'fix',      text: 'Lap times now use sub-sample interpolation at the finish-line crossing (LapDistPct=0) — eliminates up to ~8 ms timing error at 60 Hz' },
      { type: 'refactor', text: 'Lap segmentation rewritten to use LapDistPct zero-crossing detection, matching the reference algorithm for consistent outlap/inlap handling' },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-03-11',
    changes: [
      { type: 'feat', text: 'Brake chart now shows ABS cut percentage as a separate darker line per lap — tooltip displays both brake pressure and ABS cut values simultaneously' },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-03-09',
    changes: [
      { type: 'feat',     text: 'Light mode — switch between dark and light themes from the Settings modal; preference is persisted across sessions' },
      { type: 'feat',     text: 'Telemetry channel toggles — show or hide individual chart panels (Throttle, Brake, Speed, etc.) via pill buttons above the charts' },
      { type: 'feat',     text: 'Track map rebuilt on GPS coordinates (Lat/Lon) for accurate circuit rendering — dead-reckoning kept as fallback for files without GPS data' },
      { type: 'feat',     text: 'Driving Line Diff — GPS-based lateral deviation chart shows signed metres left/right of the reference lap\'s racing line' },
      { type: 'refactor', text: 'Track map lines rendered as smooth bezier curves; when two laps are selected the faster lap is drawn on top as the visual reference' },
      { type: 'refactor', text: 'Title bar, tabs, and window buttons adapt to the active theme via CSS tokens' },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-03-05',
    changes: [
      { type: 'feat',     text: 'Damper histograms now show HS/LS zone percentages (HS RBD%, LS RBD%, LS COMP%, HS COMP%) per selected lap above each corner chart' },
      { type: 'fix',      text: 'Track map driving lines now overlay correctly — starting heading is normalized so cross-lap comparisons align on the same reference' },
      { type: 'fix',      text: 'Track map is now hidden until at least one genuine full lap is loaded, preventing display on outlap-only sessions' },
      { type: 'fix',      text: 'Fastest lap indicator in the lap list now correctly excludes outlaps and inlaps from consideration' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-03-03',
    changes: [
      { type: 'feat', text: 'Window maximized state is now remembered across sessions — app reopens maximized if it was closed that way' },
    ],
  },
  {
    version: '0.7.1',
    date: '2026-03-03',
    changes: [
      { type: 'fix', text: 'Changelog and Settings modals can no longer be open simultaneously — opening one now closes the other' },
      { type: 'fix', text: 'Modal backdrop no longer covers the title bar — modals are rendered via portal and confined below the title bar' },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-03-03',
    changes: [
      { type: 'feat',     text: 'Settings modal — hardware acceleration toggle accessible from the gear icon in the title bar' },
      { type: 'feat',     text: 'Window position and size are now remembered across sessions; resets automatically if the display is disconnected' },
      { type: 'fix',      text: 'Shock velocity charts now correctly display values in mm/s instead of m/s' },
      { type: 'refactor', text: 'Shared Modal base component introduced — used by Changelog and Settings modals' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-03-03',
    changes: [
      { type: 'feat',     text: 'Shock Velocity view — per-corner shock velocity charts (m/s) with track map sync' },
      { type: 'feat',     text: 'Shocks navigation is now a dropdown with Deflection and Velocity sub-tabs' },
      { type: 'refactor', text: 'Telemetry channel label moved to bottom-left with a subtle background overlay' },
      { type: 'fix',      text: 'Telemetry x-axis distance labels now show 2 decimal places' },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-03-01',
    changes: [
      { type: 'fix',      text: 'Sidebar and tab navigation are now hidden on the empty state — only the drop zone is shown until files are loaded' },
      { type: 'perf',     text: 'Renderer packages (React, Chart.js, Zustand, etc.) moved to devDependencies — significantly reduces installer size' },
      { type: 'refactor', text: 'Only English locale bundled, removing unused Chromium locale files' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-03-01',
    changes: [
      { type: 'feat',     text: 'Track map now renders all selected laps as overlaid colored lines with per-lap position markers' },
      { type: 'feat',     text: 'Track map supports zoom (scroll wheel) and pan (drag), with double-click to reset the view' },
      { type: 'feat',     text: 'Telemetry bar shows throttle/brake/speed/gear/steering for two laps simultaneously with color-coded indicators' },
      { type: 'feat',     text: 'Sidebar width is now resizable by dragging its right edge (200–520 px), with double-click to reset' },
      { type: 'feat',     text: 'Track map height in the sidebar is now resizable by dragging the handle above it (80–480 px)' },
      { type: 'feat',     text: 'Chart panels in Telemetry, Ride Heights, and Shocks views are now resizable — drag dividers to adjust, double-click to reset' },
      { type: 'refactor', text: 'UI accent colour updated from green to blue' },
    ],
  },
  {
    version: '0.4.2',
    date: '2026-02-28',
    changes: [
      { type: 'refactor', text: 'Update banner restyled — now appears below the title bar with softer colours' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-02-28',
    changes: [
      { type: 'refactor', text: 'Tire Temp, Ride Height, and Shocks charts now use solid darker lines instead of dashed patterns for multi-position comparison' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-02-28',
    changes: [
      { type: 'feat', text: 'Changelog modal — view release history from the version badge in the title bar' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-02-28',
    changes: [
      { type: 'feat',    text: 'Auto-updater via GitHub Releases — app notifies and restarts when a new version is downloaded' },
      { type: 'perf',    text: 'IBT data arrays switched to Float32Array (~6× lower memory usage)' },
      { type: 'feat',    text: 'Pinned cursor — click any chart to lock the crosshair position across all charts and the track map' },
      { type: 'feat',    text: 'Drag-to-scrub sync across all chart panels' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-22',
    changes: [
      { type: 'feat',     text: 'Shocks view with shock velocity charts per corner' },
      { type: 'feat',     text: 'Drag-and-drop IBT loading via DropZone overlay' },
      { type: 'feat',     text: 'Telemetry input overlay on track map (throttle / brake trace)' },
      { type: 'refactor', text: 'Moved chart utilities to lib/, replaced inline SVGs with heroicons' },
      { type: 'feat',     text: 'Tire temp Y-range improvements' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-02-15',
    changes: [
      { type: 'feat', text: 'Ride Height view' },
      { type: 'feat', text: 'Tire Temperature view with corner heatmaps' },
      { type: 'feat', text: 'Damper view' },
    ],
  },
];

// ── Label config ───────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<Entry['changes'][number]['type'], { label: string; className: string }> = {
  feat:     { label: 'New',      className: 'bg-accent/10 text-accent border border-accent/20' },
  perf:     { label: 'Perf',     className: 'bg-sky-400/10 text-sky-400 border border-sky-400/20' },
  fix:      { label: 'Fix',      className: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  refactor: { label: 'Improved', className: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' },
};
