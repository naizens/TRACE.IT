import { Modal } from './Modal';
import { CHANGELOG, TYPE_LABEL } from '../../data/changelog';

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
