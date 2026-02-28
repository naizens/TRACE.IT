import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { Tab } from '../../store/useStore';

// ── Window control icons ─────────────────────────────────────────────────────
// All use a 16×16 viewport, 1.5px stroke, round caps — rendered at 12×12 px.

function IconMinimize() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line
        x1="3" y1="8" x2="13" y2="8"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Rounded square — conveys "window" / expand */}
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.25"
        stroke="currentColor" strokeWidth="1.5"
      />
    </svg>
  );
}

function IconRestore() {
  // SVG mask cuts the front window out of the back window so the overlap
  // area is invisible, giving the classic two-windows restore look.
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs>
        <mask id="wc-restore-mask">
          {/* Everything visible by default */}
          <rect width="16" height="16" fill="white" />
          {/* Knock out the area the front window occupies */}
          <rect x="1.75" y="4.75" width="9.5" height="9.5" rx="1.5" fill="black" />
        </mask>
      </defs>
      {/* Back window — only visible outside the front window's footprint */}
      <rect
        x="4.75" y="1.75" width="9.5" height="9.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.5"
        mask="url(#wc-restore-mask)"
      />
      {/* Front window — fully visible */}
      <rect
        x="1.75" y="4.75" width="9.5" height="9.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.5"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

// ── Tab types ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'telemetry',  label: 'Telemetry'    },
  { id: 'setup',      label: 'Car Setup'    },
  { id: 'damper',     label: 'Damper'       },
  { id: 'rideheight', label: 'Ride Heights' },
  { id: 'tiretemp',   label: 'Tire Temps'   },
];

// ── TitleBar ──────────────────────────────────────────────────────────────────

export function TitleBar() {
  const activeTab    = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI.windowControls.isMaximized().then(setIsMaximized);
    const unsub = window.electronAPI.windowControls.onMaximizeChange(setIsMaximized);
    return unsub;
  }, []);

  const { minimize, maximize, close } = window.electronAPI.windowControls;

  return (
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

      {/* ── Window controls ──────────────────────────────────────────────── */}
      <div
        className="flex items-stretch shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <WinButton onClick={minimize} label="Minimize">
          <IconMinimize />
        </WinButton>

        <WinButton onClick={maximize} label={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <IconRestore /> : <IconMaximize />}
        </WinButton>

        <WinButton onClick={close} label="Close" danger>
          <IconClose />
        </WinButton>
      </div>
    </header>
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
