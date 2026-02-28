import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

// ── Changelog entries ─────────────────────────────────────────────────────────

interface Entry {
  version: string;
  date: string;
  changes: { type: 'feat' | 'perf' | 'fix' | 'refactor'; text: string }[];
}

const CHANGELOG: Entry[] = [
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
      { type: 'feat',    text: 'Shocks view with shock velocity charts per corner' },
      { type: 'feat',    text: 'Drag-and-drop IBT loading via DropZone overlay' },
      { type: 'feat',    text: 'Telemetry input overlay on track map (throttle / brake trace)' },
      { type: 'refactor', text: 'Moved chart utilities to lib/, replaced inline SVGs with heroicons' },
      { type: 'feat',    text: 'Tire temp Y-range improvements' },
    ],
  },
  {
    version: '0.0.4',
    date: '2026-02-15',
    changes: [
      { type: 'feat',    text: 'Ride Height view' },
      { type: 'feat',    text: 'Tire Temperature view with corner heatmaps' },
      { type: 'feat',    text: 'Damper view' },
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
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 max-h-[70vh] flex flex-col rounded-xl bg-surface border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-text tracking-wide">Changelog</h2>
            <p className="text-[11px] text-muted mt-0.5">TRACE.IT release history</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              {/* Version header */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-xs font-bold text-text">v{entry.version}</span>
                <span className="text-[10px] text-muted">{entry.date}</span>
              </div>

              {/* Change list */}
              <ul className="space-y-2">
                {entry.changes.map((change, i) => {
                  const { label, className } = TYPE_LABEL[change.type];
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${className}`}>
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
      </div>
    </div>
  );
}
