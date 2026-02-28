import { useEffect, useState } from 'react';

export function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = window.electronAPI.updates.onUpdateDownloaded(() => setReady(true));
    return unsub;
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-accent px-4 py-3 text-sm text-white shadow-lg">
      <span>Update downloaded — restart to apply.</span>
      <button
        onClick={() => window.electronAPI.updates.installNow()}
        className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30"
      >
        Restart now
      </button>
    </div>
  );
}
