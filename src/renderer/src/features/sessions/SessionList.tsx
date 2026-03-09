import { useStore } from '../../store/useStore';

export function SessionList() {
  const sessions = useStore((s) => s.sessions);
  const removeSession = useStore((s) => s.removeSession);

  if (sessions.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1.5">
        Sessions
      </p>
      <div className="flex flex-col gap-0.5">
        {sessions.map((session, i) => (
          <div
            key={`${session._filename}-${i}`}
            className="group flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          >
            {/* Colour indicator — primary session is green */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: i === 0 ? '#00ff88' : '#52525b' }}
            />
            <span
              className="flex-1 truncate font-mono text-[9px]"
              style={{ color: i === 0 ? 'var(--color-text)' : 'var(--color-muted)' }}
              title={session._filename}
            >
              {session._filename}
            </span>
            <button
              onClick={() => removeSession(i)}
              className="text-muted hover:text-red-500 transition-colors text-[11px] leading-none cursor-pointer"
              title="Remove session"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
