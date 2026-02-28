import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { Tab } from '../../store/useStore';
import {
  MinusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid';
import { ChangelogModal } from '../ui/ChangelogModal';

// ── Tab types ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'telemetry',  label: 'Telemetry'    },
  { id: 'setup',      label: 'Car Setup'    },
  { id: 'damper',     label: 'Damper'       },
  { id: 'shocks',     label: 'Shocks'       },
  { id: 'rideheight', label: 'Ride Heights' },
  { id: 'tiretemp',   label: 'Tire Temps'   },
];

// ── TitleBar ──────────────────────────────────────────────────────────────────

export function TitleBar() {
  const activeTab    = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const [isMaximized, setIsMaximized] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    window.electronAPI.windowControls.isMaximized().then(setIsMaximized);
    const unsub = window.electronAPI.windowControls.onMaximizeChange(setIsMaximized);
    return unsub;
  }, []);

  const { minimize, maximize, close } = window.electronAPI.windowControls;

  return (
    <>
    <header
      className="flex h-9 flex-shrink-0 items-stretch bg-[#0c0c0e] border-b border-border select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 gap-0.5 shrink-0">
        <span className="text-accent font-black text-[11px] tracking-[0.2em]">TRACE</span>
        <span className="text-text  font-black text-[11px] tracking-[0.2em]">.IT</span>
      </div>

      {/* Separator */}
      <div className="w-px bg-border my-2 shrink-0" />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <nav
        className="flex items-stretch gap-0.5 px-1"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'relative flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider',
                'transition-colors duration-150 cursor-pointer',
                active ? 'text-text' : 'text-[#52525b] hover:text-[#a1a1aa]',
              ].join(' ')}
            >
              {label}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Drag spacer ──────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Changelog button ─────────────────────────────────────────────── */}
      <div className="flex items-center pr-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => setChangelogOpen(true)}
          title="Changelog"
          className="flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          v0.0.9
        </button>
      </div>

      {/* ── Window controls ──────────────────────────────────────────────── */}
      <div
        className="flex items-stretch shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <WinButton onClick={minimize} label="Minimize">
          <MinusIcon className="w-3 h-3" />
        </WinButton>

        <WinButton onClick={maximize} label={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized
            ? <ArrowsPointingInIcon className="w-3 h-3" />
            : <ArrowsPointingOutIcon className="w-3 h-3" />}
        </WinButton>

        <WinButton onClick={close} label="Close" danger>
          <XMarkIcon className="w-3 h-3" />
        </WinButton>
      </div>
    </header>

    <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}

// ── WinButton ─────────────────────────────────────────────────────────────────

interface WinButtonProps {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}

function WinButton({ onClick, label, danger = false, children }: WinButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        'flex items-center justify-center w-11 h-full',
        'text-[#52525b] transition-all duration-150 cursor-default',
        danger
          ? 'hover:bg-red-600/90 hover:text-white'
          : 'hover:bg-white/[0.07] hover:text-[#d4d4d8]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
