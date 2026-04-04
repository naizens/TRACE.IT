import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import {
  MinusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  Cog6ToothIcon,
} from '@heroicons/react/16/solid';
import { ChangelogModal } from '../ui/ChangelogModal';
import { SettingsModal } from '../ui/SettingsModal';
import { ShocksDropdown } from './ShocksDropdown';
import { TABS_BEFORE, TABS_AFTER } from '../../lib/tabConfig';

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
      className="flex h-9 shrink-0 items-stretch bg-titlebar border-b border-border select-none"
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
                  active ? 'text-text' : 'text-tab-inactive hover:text-tab-inactive-hover',
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
                  active ? 'text-text' : 'text-tab-inactive hover:text-tab-inactive-hover',
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
          v0.11.2
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
        'text-winbtn transition-all duration-150 cursor-default',
        danger
          ? 'hover:bg-red-600/90 hover:text-white'
          : 'hover:bg-overlay-active hover:text-winbtn-hover-text',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
