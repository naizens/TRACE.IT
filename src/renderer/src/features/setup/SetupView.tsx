import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { COLOR_ORDER, getLapColor, LAP_COLORS } from '../../lib/constants';
import { CarDiagram, type SetupEntry } from './CarDiagram';

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
  const sessions   = useStore((s) => s.sessions);
  const selections = useStore((s) => s.selections);
  const [viewMode, setViewMode] = useState<'table' | 'diagram'>('diagram');

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-wider uppercase select-none">
        No sessions loaded
      </div>
    );
  }

  // Prefer the current lap selection (green/red) — setup follows whichever
  // lap you're comparing, consistent with Telemetry/Driving tabs. Falls back
  // to "one entry per loaded session" when nothing is selected.
  const fromSelection: SetupEntry[] = COLOR_ORDER
    .map((color) => {
      const key = Object.keys(selections).find((k) => selections[k] === color);
      if (!key) return null;
      const colon      = key.indexOf(':');
      const sessionIdx = parseInt(key.substring(0, colon));
      const lapIdx     = parseInt(key.substring(colon + 1));
      const sess = sessions[sessionIdx];
      const lap  = sess?.laps[lapIdx];
      if (!sess || !lap) return null;
      const label = sessions.length > 1 ? `S${sessionIdx + 1}·L${lap.lap}` : `L${lap.lap}`;
      return { session: sess, label, color: getLapColor(color) };
    })
    .filter((x): x is SetupEntry => x != null);

  const entries: SetupEntry[] = fromSelection.length > 0
    ? fromSelection
    : sessions.map((s, i) => ({
        session: s,
        label:   s._filename,
        // Cards always label these columns "REF"/"LAP" — match that with the
        // same green/red palette used once laps are actually selected.
        color:   i === 0 ? LAP_COLORS.ref : LAP_COLORS.blue,
      }));

  const setups = entries.map((e) => e.session.setup as Record<string, unknown>);
  const multi  = entries.length > 1;

  // Collect all sections across all entries
  const allSections = [...new Set(setups.flatMap((s) => Object.keys(s)))];

  const toggleButtons = (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex rounded overflow-hidden border border-border">
        {(['table', 'diagram'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={[
              'px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest cursor-pointer transition-colors',
              viewMode === mode ? 'bg-accent text-black' : 'text-muted hover:text-text hover:bg-surface-2',
            ].join(' ')}
          >
            {mode}
          </button>
        ))}
      </div>
      {viewMode === 'diagram' && <span className="text-[9px] text-muted whitespace-nowrap">GT3 setup fields</span>}
    </div>
  );

  if (viewMode === 'diagram') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <CarDiagram entries={entries} toolbar={toggleButtons} />
      </div>
    );
  }

  const modeToggle = (
    <div className="flex items-center gap-1.5 px-3 pt-3 shrink-0">
      {toggleButtons}
      {fromSelection.length === 0 && (
        <span className="text-[9px] text-muted">
          No laps selected — showing {multi ? 'all loaded sessions' : 'the loaded session'}. Select laps in the sidebar to compare specific runs.
        </span>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {modeToggle}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {allSections.map((section) => {
        // Skip sections that aren't objects in any entry
        if (!setups.some((s) => typeof s[section] === 'object' && s[section] !== null)) {
          return null;
        }

        // Flatten each entry's section to key→value strings
        const flatByEntry = setups.map((s) => {
          const raw = s[section];
          if (typeof raw !== 'object' || raw === null) return {};
          return flattenSetupSection(raw as Record<string, unknown>);
        });

        const allKeys = [...new Set(flatByEntry.flatMap((f) => Object.keys(f)))];

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
              {/* Column headers (only visible with multiple entries) */}
              {multi && (
                <thead>
                  <tr>
                    <th className="py-1.5 px-3 text-left text-[9px] text-muted font-semibold w-[38%]">
                      Parameter
                    </th>
                    {entries.map((e, i) => (
                      <th
                        key={i}
                        className="py-1.5 px-2 text-right text-[9px] font-semibold max-w-25 truncate"
                        style={{ color: e.color }}
                        title={e.label}
                      >
                        {e.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}

              <tbody className="divide-y divide-border/50">
                {allKeys.map((key) => {
                  const cells = flatByEntry.map((f) => f[key] ?? '—');
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
                            className="py-1 px-2 text-right tabular-nums"
                            style={{ color: hasDiff ? entries[i].color : 'var(--color-text)' }}
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
    </div>
  );
}
