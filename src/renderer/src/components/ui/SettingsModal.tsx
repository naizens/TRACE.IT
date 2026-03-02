import { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface Config {
  hardwareAcceleration: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) window.electronAPI.settings.get().then(setConfig);
  }, [open]);

  const toggle = async (key: keyof Config, value: boolean) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
    setSaving(true);
    await window.electronAPI.settings.set({ [key]: value });
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings" subtitle="Changes marked with * require a restart to take effect.">
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Section: Performance */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">Performance</h3>
          {config && (
            <SettingRow
              label="Hardware Acceleration *"
              description="Uses the GPU to render the UI. Disable if you experience graphical glitches or blank windows."
              checked={config.hardwareAcceleration}
              onChange={(v) => toggle('hardwareAcceleration', v)}
            />
          )}
        </div>

        {/* Restart banner */}
        {dirty && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-2 border border-border">
            <span className="text-[11px] text-muted flex-1">
              {saving ? 'Saving…' : 'Restart TRACE.IT to apply changes.'}
            </span>
            {!saving && (
              <button
                onClick={() => window.electronAPI.settings.relaunch()}
                className="flex items-center px-3 py-1 rounded text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer"
              >
                Restart now
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── SettingRow ─────────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function SettingRow({ label, description, checked, onChange }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-bg border border-border">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[12px] font-semibold text-text">{label}</span>
        <span className="text-[11px] text-muted leading-relaxed">{description}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer',
        checked ? 'bg-accent' : 'bg-surface-2 border border-border',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
