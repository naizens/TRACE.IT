import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Extra classes applied to the panel (e.g. max-h-[70vh]) */
  panelClassName?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, subtitle, panelClassName, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={['relative w-full max-w-lg mx-4 flex flex-col rounded-xl bg-surface border border-border shadow-2xl', panelClassName].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-text tracking-wide">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
