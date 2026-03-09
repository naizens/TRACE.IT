import { Modal } from './Modal';

// ── Changelog entries ─────────────────────────────────────────────────────────

interface Entry {
  version: string;
  date: string;
  changes: { type: 'feat' | 'perf' | 'fix' | 'refactor'; text: string }[];
}

const CHANGELOG: Entry[] = [
  {
    version: '0.0.17',
    date: '2026-03-09',
    changes: [
      { type: 'feat',     text: 'Light mode — switch between dark and light themes from the Settings modal; preference is persisted across sessions' },
      { type: 'feat',     text: 'Driving Line chart added to Telemetry view — shows lateral track position over lap distance' },
      { type: 'refactor', text: 'Title bar, tabs, and window buttons adapt to the active theme via CSS tokens' },
    ],
  },
  {
    version: '0.0.16',
    date: '2026-03-05',
    changes: [
      { type: 'feat',     text: 'Damper histograms now show HS/LS zone percentages (HS RBD%, LS RBD%, LS COMP%, HS COMP%) per selected lap above each corner chart' },
      { type: 'fix',      text: 'Track map driving lines now overlay correctly — starting heading is normalized so cross-lap comparisons align on the same reference' },
      { type: 'fix',      text: 'Track map is now hidden until at least one genuine full lap is loaded, preventing display on outlap-only sessions' },
      { type: 'fix',      text: 'Fastest lap indicator in the lap list now correctly excludes outlaps and inlaps from consideration' },
    ],
  },
  {
    version: '0.0.15',
    date: '2026-03-03',
    changes: [
      { type: 'feat', text: 'Window maximized state is now remembered across sessions — app reopens maximized if it was closed that way' },
    ],
  },
  {
    version: '0.0.14',
    date: '2026-03-03',
    changes: [
      { type: 'fix', text: 'Changelog and Settings modals can no longer be open simultaneously — opening one now closes the other' },
      { type: 'fix', text: 'Modal backdrop no longer covers the title bar — modals are rendered via portal and confined below the title bar' },
    ],
  },
  {
    version: '0.0.13',
    date: '2026-03-03',
    changes: [
      { type: 'feat',     text: 'Settings modal — hardware acceleration toggle accessible from the gear icon in the title bar' },
      { type: 'feat',     text: 'Window position and size are now remembered across sessions; resets automatically if the display is disconnected' },
      { type: 'fix',      text: 'Shock velocity charts now correctly display values in mm/s instead of m/s' },
      { type: 'refactor', text: 'Shared Modal base component introduced — used by Changelog and Settings modals' },
    ],
  },
  {
    version: '0.0.12',
    date: '2026-03-03',
    changes: [
      { type: 'feat',     text: 'Shock Velocity view — per-corner shock velocity charts (m/s) with track map sync' },
      { type: 'feat',     text: 'Shocks navigation is now a dropdown with Deflection and Velocity sub-tabs' },
      { type: 'refactor', text: 'Telemetry channel label moved to bottom-left with a subtle background overlay' },
      { type: 'fix',      text: 'Telemetry x-axis distance labels now show 2 decimal places' },
    ],
  },
  {
    version: '0.0.11',
    date: '2026-03-01',
    changes: [
      { type: 'fix',      text: 'Sidebar and tab navigation are now hidden on the empty state — only the drop zone is shown until files are loaded' },
      { type: 'perf',     text: 'Renderer packages (React, Chart.js, Zustand, etc.) moved to devDependencies — significantly reduces installer size' },
      { type: 'refactor', text: 'Only English locale bundled, removing unused Chromium locale files' },
    ],
  },
  {
    version: '0.0.10',
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
    version: '0.0.9',
    date: '2026-02-28',
    changes: [
      { type: 'refactor', text: 'Update banner restyled — now appears below the title bar with softer colours' },
    ],
  },
  {
    version: '0.0.8',
    date: '2026-02-28',
    changes: [
      { type: 'refactor', text: 'Tire Temp, Ride Height, and Shocks charts now use solid darker lines instead of dashed patterns for multi-position comparison' },
    ],
  },
  {
    version: '0.0.7',
    date: '2026-02-28',
    changes: [
      { type: 'feat', text: 'Changelog modal — view release history from the version badge in the title bar' },
    ],
  },
  {
    version: '0.0.6',
    date: '2026-02-28',
    changes: [
      { type: 'feat',    text: 'Auto-updater via GitHub Releases — app notifies and restarts when a new version is downloaded' },
      { type: 'perf',    text: 'IBT data arrays switched to Float32Array (~6× lower memory usage)' },
      { type: 'feat',    text: 'Pinned cursor — click any chart to lock the crosshair position across all charts and the track map' },
      { type: 'feat',    text: 'Drag-to-scrub sync across all chart panels' },
    ],
  },
  {
    version: '0.0.5',
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
    version: '0.0.4',
    date: '2026-02-15',
    changes: [
      { type: 'feat', text: 'Ride Height view' },
      { type: 'feat', text: 'Tire Temperature view with corner heatmaps' },
      { type: 'feat', text: 'Damper view' },
    ],
  },
];

// ── Label config ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Entry['changes'][number]['type'], { label: string; className: string }> = {
  feat:     { label: 'New',      className: 'bg-accent/10 text-accent border border-accent/20' },
  perf:     { label: 'Perf',     className: 'bg-sky-400/10 text-sky-400 border border-sky-400/20' },
  fix:      { label: 'Fix',      className: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  refactor: { label: 'Improved', className: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' },
};

// ── ChangelogModal ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangelogModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Changelog" subtitle="TRACE.IT release history" panelClassName="max-h-[70vh]">
      <div className="overflow-y-auto px-5 py-4 space-y-6">
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-xs font-bold text-text">v{entry.version}</span>
              <span className="text-[10px] text-muted">{entry.date}</span>
            </div>
            <ul className="space-y-2">
              {entry.changes.map((change, i) => {
                const { label, className } = TYPE_LABEL[change.type];
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center w-16 rounded py-0.5 text-[9px] font-bold uppercase tracking-wide ${className}`}>
                      {label}
                    </span>
                    <span className="text-[11px] text-muted leading-relaxed">{change.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
