import { useStore } from '../../store/useStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenSetupSection(
  section: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(section)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      for (const [sk, sv] of Object.entries(val as Record<string, unknown>)) {
        out[`${key} [${sk}]`] = sv != null ? String(sv) : '—';
      }
    } else {
      out[key] = val != null ? String(val) : '—';
    }
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SetupView() {
  const sessions = useStore((s) => s.sessions);

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
        No sessions loaded
      </div>
    );
  }

  const names  = sessions.map((s) => s._filename);
  const setups = sessions.map((s) => s.setup as Record<string, unknown>);
  const multi  = sessions.length > 1;

  // Collect all sections across all sessions
  const allSections = [...new Set(setups.flatMap((s) => Object.keys(s)))];

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {allSections.map((section) => {
        // Skip sections that aren't objects in any session
        if (!setups.some((s) => typeof s[section] === 'object' && s[section] !== null)) {
          return null;
        }

        // Flatten each session's section to key→value strings
        const flatBySession = setups.map((s) => {
          const raw = s[section];
          if (typeof raw !== 'object' || raw === null) return {};
          return flattenSetupSection(raw as Record<string, unknown>);
        });

        const allKeys = [...new Set(flatBySession.flatMap((f) => Object.keys(f)))];

        return (
          <div
            key={section}
            className="bg-surface border border-border rounded-lg overflow-hidden"
          >
            {/* Section header */}
            <div className="px-3 py-2 border-b border-border bg-surface-2">
              <h3 className="text-accent text-[10px] font-black uppercase tracking-widest">
                {section}
              </h3>
            </div>

            {/* Table */}
            <table className="w-full text-[11px] font-mono">
              {/* Column headers (only visible with multiple sessions) */}
              {multi && (
                <thead>
                  <tr>
                    <th className="py-1.5 px-3 text-left text-[9px] text-muted font-semibold w-[38%]">
                      Parameter
                    </th>
                    {names.map((n) => (
                      <th
                        key={n}
                        className="py-1.5 px-2 text-right text-[9px] text-muted font-semibold max-w-25 truncate"
                        title={n}
                      >
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}

              <tbody className="divide-y divide-border/50">
                {allKeys.map((key) => {
                  const cells = flatBySession.map((f) => f[key] ?? '—');
                  const hasDiff = multi && !cells.every((c) => c === cells[0]);

                  return (
                    <tr key={key} className="hover:bg-surface-2 transition-colors">
                      {/* Parameter label */}
                      <td
                        className="py-1 px-3 text-muted"
                        dangerouslySetInnerHTML={{ __html: key }}
                      />
                      {multi ? (
                        cells.map((cell, i) => (
                          <td
                            key={i}
                            className={`py-1 px-2 text-right tabular-nums ${
                              hasDiff ? 'text-yellow-400' : 'text-text'
                            }`}
                          >
                            {cell}
                          </td>
                        ))
                      ) : (
                        <td className="py-1 px-3 text-right text-text tabular-nums">
                          {cells[0]}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
