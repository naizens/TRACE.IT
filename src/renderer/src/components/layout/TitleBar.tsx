import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import type { Tab } from '../../store/useStore';
import {
  MinusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
} from '@heroicons/react/16/solid';
import { ChangelogModal } from '../ui/ChangelogModal';
import { SettingsModal } from '../ui/SettingsModal';

// ── Tab types ────────────────────────────────────────────────────────────────

const TABS_BEFORE: { id: Tab; label: string }[] = [
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'damper',    label: 'Damper'    },
];

const TABS_AFTER: { id: Tab; label: string }[] = [
  { id: 'rideheight', label: 'Ride Heights' },
  { id: 'tiretemp',   label: 'Tire Temps'   },
  { id: 'setup',      label: 'Car Setup'    },
];

const SHOCK_TABS: { id: Tab; label: string }[] = [
  { id: 'shocks',   label: 'Deflection' },
  { id: 'shockvel', label: 'Velocity'   },
];

// ── TitleBar ──────────────────────────────────────────────────────────────────

export function TitleBar() {
  const activeTab    = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const hasSessions  = useStore((s) => s.sessions.length > 0);

  const [isMaximized, setIsMaximized] = useState(false);
  const [openModal, setOpenModal] = useState<'changelog' | 'settings' | null>(null);

  useEffect(() => {
    window.electronAPI.windowControls.isMaximized().then(setIsMaximized);
    const unsub = window.electronAPI.windowControls.onMaximizeChange(setIsMaximized);
    return unsub;
  }, []);

  const { minimize, maximize, close } = window.electronAPI.windowControls;

  return (
    <>
    <header
      className="flex h-9 shrink-0 items-stretch bg-[#0c0c0e] border-b border-border select-none"
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
      {hasSessions && (
        <nav
          className="flex items-stretch gap-0.5 px-1"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {TABS_BEFORE.map(({ id, label }) => {
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

          <ShocksDropdown activeTab={activeTab} setActiveTab={setActiveTab} />

          {TABS_AFTER.map(({ id, label }) => {
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
      )}

      {/* ── Drag spacer ──────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Settings + Changelog ─────────────────────────────────────────── */}
      <div className="flex items-center pr-2 gap-1 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => setOpenModal('settings')}
          title="Settings"
          className="flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer text-muted hover:text-text hover:bg-surface-2"
        >
          <Cog6ToothIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setOpenModal('changelog')}
          title="Changelog"
          className="flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          v0.0.15
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

    <ChangelogModal open={openModal === 'changelog'} onClose={() => setOpenModal(null)} />
    <SettingsModal  open={openModal === 'settings'}  onClose={() => setOpenModal(null)} />
    </>
  );
}

// ── ShocksDropdown ────────────────────────────────────────────────────────────

interface ShocksDropdownProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

function ShocksDropdown({ activeTab, setActiveTab }: ShocksDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = activeTab === 'shocks' || activeTab === 'shockvel';

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative flex items-stretch"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={[
          'relative flex items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider',
          'transition-colors duration-150 cursor-pointer',
          isActive ? 'text-text' : 'text-[#52525b] hover:text-[#a1a1aa]',
        ].join(' ')}
      >
        Shocks
        <ChevronDownIcon
          className={[
            'w-2.5 h-2.5 transition-transform duration-150',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
        {isActive && (
          <span className="absolute bottom-0 left-2 right-6 h-0.5 rounded-t-full bg-accent" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 min-w-27.5 rounded-b-md border border-t-0 border-border bg-[#0c0c0e] shadow-lg py-1">
          {SHOCK_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setOpen(false); }}
              className={[
                'flex w-full items-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
                'transition-colors duration-150 cursor-pointer',
                activeTab === id
                  ? 'text-text bg-white/5'
                  : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-white/4',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
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
