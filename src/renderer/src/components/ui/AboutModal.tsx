import { useState } from 'react';
import { Modal } from './Modal';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import appIcon from '../../assets/icon.png';

interface Props {
  open: boolean;
  onClose: () => void;
}

const LIBRARIES: { name: string; description: string; url: string }[] = [
  { name: 'Electron',            description: 'Cross-platform desktop apps',  url: 'https://github.com/electron/electron' },
  { name: 'React',               description: 'UI framework',                  url: 'https://github.com/facebook/react' },
  { name: 'TypeScript',          description: 'Type-safe JavaScript',          url: 'https://github.com/microsoft/TypeScript' },
  { name: 'Tailwind CSS',        description: 'Utility-first CSS framework',   url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'Zustand',             description: 'State management',              url: 'https://github.com/pmndrs/zustand' },
  { name: 'Chart.js',            description: 'Canvas-based charting',         url: 'https://github.com/chartjs/Chart.js' },
  { name: 'electron-vite',       description: 'Build tooling for Electron',    url: 'https://github.com/alex8088/electron-vite' },
  { name: 'electron-updater',    description: 'Auto-update delivery',          url: 'https://github.com/electron-userland/electron-builder' },
  { name: 'chartjs-plugin-zoom', description: 'Zoom & pan for Chart.js',      url: 'https://github.com/chartjs/chartjs-plugin-zoom' },
  { name: 'Heroicons',           description: 'Icon library',                  url: 'https://github.com/tailwindlabs/heroicons' },
];

function openUrl(url: string) {
  window.electronAPI.shell.openExternal(url);
}

export function AboutModal({ open, onClose }: Props) {
  const [creditsOpen, setCreditsOpen] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="About" panelClassName="max-h-[80vh]">
      <div className="overflow-y-auto px-5 py-4 space-y-0 divide-y divide-border">

        {/* ── App identity ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pb-5">
          <img src={appIcon} alt="TRACE.IT icon" className="w-14 h-14 rounded-xl shrink-0" />
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black tracking-wider">
                <span className="text-accent">TRACE</span>
                <span className="text-text">.IT</span>
              </span>
              <span className="text-[10px] text-muted font-mono">v0.12.0</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed max-w-xs">
              A desktop telemetry analysis tool for iRacing — overlay laps, inspect
              suspension data, and compare setups.
            </p>
          </div>
        </div>

        {/* ── Connect ───────────────────────────────────────────────────────── */}
        <div className="py-5 space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Connect</h3>
          <button
            onClick={() => openUrl('https://github.com/naizens/TRACE.IT')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-bg border border-border hover:border-border/80 hover:bg-surface-2 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <GitHubIcon className="w-3.5 h-3.5 text-muted group-hover:text-text transition-colors" />
              <span className="text-[12px] font-semibold text-text">GitHub Repository</span>
            </div>
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-muted group-hover:text-text transition-colors" />
          </button>
        </div>

        {/* ── Privacy ───────────────────────────────────────────────────────── */}
        <div className="py-5 space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Privacy</h3>
          <p className="text-[11px] text-muted leading-relaxed">
            TRACE.IT does not collect, store, or transmit any personal data or usage
            analytics. All data stays on your machine.
          </p>
        </div>

        {/* ── Open source credits (collapsible) ─────────────────────────────── */}
        <div className="pt-4">
          <button
            onClick={() => setCreditsOpen((v) => !v)}
            className="w-full flex items-center justify-between py-1 cursor-pointer group"
          >
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted group-hover:text-text transition-colors">
              Open Source Credits
            </h3>
            {creditsOpen
              ? <ChevronUpIcon className="w-3.5 h-3.5 text-muted" />
              : <ChevronDownIcon className="w-3.5 h-3.5 text-muted" />}
          </button>

          {creditsOpen && (
            <div className="mt-4 space-y-3 pb-2">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-muted/60">Open Source Libraries</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {LIBRARIES.map(({ name, description, url }) => (
                    <button
                      key={name}
                      onClick={() => openUrl(url)}
                      className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-bg border border-border hover:border-border/80 hover:bg-surface-2 transition-colors text-left cursor-pointer group"
                    >
                      <span className="text-[11px] font-semibold text-text group-hover:text-text">{name}</span>
                      <span className="text-[10px] text-muted">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="px-5 py-3 border-t border-border shrink-0">
        <p className="text-[10px] text-muted/50 text-center">ESC to close</p>
      </div>
    </Modal>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
        .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
        -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
        1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
        1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
        1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
