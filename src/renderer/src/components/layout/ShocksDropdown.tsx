import { useState, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import type { Tab } from '../../store/useStore';
import { SHOCK_TABS } from '../../lib/tabConfig';

interface Props {
  activeTab:    Tab;
  setActiveTab: (tab: Tab) => void;
}

export function ShocksDropdown({ activeTab, setActiveTab }: Props) {
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
          isActive ? 'text-text' : 'text-tab-inactive hover:text-tab-inactive-hover',
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
        <div className="absolute top-full left-0 z-50 min-w-27.5 rounded-b-md border border-t-0 border-border bg-titlebar shadow-lg py-1">
          {SHOCK_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setOpen(false); }}
              className={[
                'flex w-full items-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
                'transition-colors duration-150 cursor-pointer',
                activeTab === id
                  ? 'text-text bg-overlay-active'
                  : 'text-tab-inactive hover:text-tab-inactive-hover hover:bg-overlay-hover',
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
