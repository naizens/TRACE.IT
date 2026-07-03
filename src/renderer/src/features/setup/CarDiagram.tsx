import type { ParsedSession } from '../../types/session';

// ── GT3 setup field lookup ───────────────────────────────────────────────────
// Field paths follow iRacing's GT3-class CarSetup YAML schema (verified against
// a McLaren 720S GT3 EVO setup). Other classes (oval, formula, ...) use
// different section names — this view is scoped to GT3 for now, missing
// fields just render as "—" rather than throwing.

type Corner = 'LeftFront' | 'RightFront' | 'LeftRear' | 'RightRear';
type Axle   = 'FrontDampers' | 'RearDampers';

export interface SetupEntry {
  session: ParsedSession;
  label:   string; // e.g. "S1·L47" — shown in the legend above the diagram
  color:   string; // lap/session color dot
}

function get(setup: Record<string, unknown>, path: string[]): string {
  let cur: unknown = setup;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return '—';
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur != null ? String(cur) : '—';
}

/** Tries each path in order, returning the first one that resolves — section
 * names for the same logical group (e.g. differential) differ across car
 * models (e.g. "Differential" vs. "GearsDifferential" on the Ferrari). */
function getAny(setup: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    const v = get(setup, path);
    if (v !== '—') return v;
  }
  return '—';
}

/**
 * "159 kPa" → { value: "159", unit: "kPa" }; "-4.0 deg" → { value: "-4.0", unit: "deg" };
 * "53.8%" → { value: "53.8", unit: "%" }.
 * The "unit" (if attached with no space, e.g. "%") must NOT start with a digit
 * or "-" — otherwise a compound code like Lamborghini's ArbBlades "2-2" would
 * get mangled into value "2" / unit "-2". Those fall through unsplit instead.
 */
function splitValueUnit(raw: string): { value: string; unit: string } {
  const m = raw.match(/^([+-]?\d[\d.]*)\s*([^\d-].*)?$/);
  if (!m) return { value: raw, unit: '' };
  return { value: m[1], unit: m[2] ?? '' };
}

/** "4 (ABS)" → "4"; "Medium friction" → "Medium" — drop trailing annotation/words. */
function firstToken(raw: string): string {
  return raw.split(/[\s(]/)[0] || raw;
}

/** True only for cars that set dampers per corner (e.g. Mercedes), not per axle. */
function hasCornerDampers(setup: Record<string, unknown>): boolean {
  return get(setup, ['Dampers', 'LeftFront', 'LsCompDamping']) !== '—';
}

interface CornerData {
  springRate:     string;
  rideHeight:     string;
  camber:         string;
  bumpRubberGap:  string;
  toeIn:          string | null; // rear corners only
  lsComp:         string | null; // only set for per-corner-damper cars
  hsComp:         string | null;
  lsRbd:          string | null;
  hsRbd:          string | null;
}

function getCorner(setup: Record<string, unknown>, corner: Corner): CornerData {
  const isRear = corner === 'LeftRear' || corner === 'RightRear';
  const perCorner = hasCornerDampers(setup);
  return {
    springRate:    get(setup, ['Chassis', corner, 'SpringRate']),
    rideHeight:    get(setup, ['Chassis', corner, 'RideHeight']),
    camber:        get(setup, ['Chassis', corner, 'Camber']),
    bumpRubberGap: get(setup, ['Chassis', corner, 'BumpRubberGap']),
    // Porsche has no per-corner rear ToeIn — only a combined axle value.
    toeIn: isRear ? getAny(setup, [['Chassis', corner, 'ToeIn'], ['Chassis', 'Rear', 'TotalToeIn']]) : null,
    // Only populated for cars that actually set dampers per corner (Mercedes).
    // Axle-based cars (the common case) keep these null — their dampers show
    // in the separate FRONT/REAR DAMPER cards instead, not duplicated 4x here.
    lsComp: perCorner ? get(setup, ['Dampers', corner, 'LsCompDamping']) : null,
    hsComp: perCorner ? get(setup, ['Dampers', corner, 'HsCompDamping']) : null,
    lsRbd:  perCorner ? get(setup, ['Dampers', corner, 'LsRbdDamping'])  : null,
    hsRbd:  perCorner ? get(setup, ['Dampers', corner, 'HsRbdDamping'])  : null,
  };
}

function getFrontAxle(setup: Record<string, unknown>) {
  return {
    arb: getAny(setup, [
      ['Chassis', 'FrontBrakesLights', 'ArbBlades'],
      ['Chassis', 'FrontBrakes', 'ArbBlades'],
      ['Chassis', 'FrontBrakesLights', 'ArbSetting'], // Mercedes — code (e.g. "D3") instead of a blade count
      ['Chassis', 'FrontBrakesLights', 'FarbBlades'],  // typo on Aston Martin Vantage Evo GT3
    ]),
    toeIn:          getAny(setup, [['Chassis', 'FrontBrakesLights', 'TotalToeIn'],               ['Chassis', 'FrontBrakes', 'TotalToeIn']]),
    splitterHeight: getAny(setup, [['Chassis', 'FrontBrakesLights', 'CenterFrontSplitterHeight'], ['Chassis', 'FrontBrakes', 'CenterFrontSplitterHeight']]),
  };
}

function getRearAxle(setup: Record<string, unknown>) {
  return {
    wing: getAny(setup, [
      ['TiresAero', 'AeroBalanceCalc', 'RearWingAngle'],
      ['TiresAero', 'AeroBalanceCalc', 'WingSetting'], // BMW M4 GT3 Evo
      ['TiresAero', 'AeroBalanceCalculator', 'RearWingAngle'], // Aston Martin Vantage Evo GT3
      ['Chassis', 'Rear', 'RearWingAngle'],
      ['Chassis', 'Rear', 'WingAngle'],   // BMW
      ['Chassis', 'Rear', 'WingSetting'], // Porsche 992 GT3 R
    ]),
    frictionFaces: getAny(setup, [
      ['Chassis', 'Differential', 'FrictionFaces'],
      ['Chassis', 'GearsDifferential', 'FrictionFaces'],
      ['Chassis', 'Differential', 'DiffFrictionFaces'], // Mercedes
    ]),
    diffPreload:   getAny(setup, [['Chassis', 'Differential', 'DiffPreload'],   ['Chassis', 'GearsDifferential', 'DiffPreload']]),
    arb:           getAny(setup, [
      ['Chassis', 'Rear', 'ArbBlades'],
      ['Chassis', 'Rear', 'RarbBlades'],  // typo on Ford Mustang GT3
      ['Chassis', 'Rear', 'RarbRate'],    // Mercedes — code (e.g. "D5") instead of a blade count
      ['Chassis', 'Rear', 'RarbSetting'], // Porsche 992 GT3 R
    ]),
  };
}

function getElectronics(setup: Record<string, unknown>) {
  return {
    abs:       firstToken(get(setup, ['Chassis', 'InCarAdjustments', 'AbsSetting'])),
    tc:        firstToken(get(setup, ['Chassis', 'InCarAdjustments', 'TcSetting'])),
    brakeBias: get(setup, ['Chassis', 'InCarAdjustments', 'BrakePressureBias']),
    // Same "FIA"/"FiA" gearbox-spec value, just filed under different keys per car.
    gearStack: getAny(setup, [
      ['Chassis', 'GearsDifferential', 'GearStack'],
      ['Chassis', 'GearsDifferential', 'SixthGear'], // Lamborghini / Audi
      ['Chassis', 'Differential', 'GearStack'],
    ]),
  };
}

function getBrakes(setup: Record<string, unknown>) {
  return {
    frontMasterCyl: getAny(setup, [['Chassis', 'FrontBrakesLights', 'FrontMasterCyl'], ['Chassis', 'FrontBrakes', 'FrontMasterCyl']]),
    rearMasterCyl:  getAny(setup, [['Chassis', 'FrontBrakesLights', 'RearMasterCyl'],  ['Chassis', 'FrontBrakes', 'RearMasterCyl']]),
    brakePads:      firstToken(getAny(setup, [['Chassis', 'FrontBrakesLights', 'BrakePads'], ['Chassis', 'FrontBrakes', 'BrakePads']])),
  };
}

const FRONT_AXLE_FIELDS: RowField[] = [
  { label: 'ARB:',              key: 'arb' },
  { label: 'Toe-In:',           key: 'toeIn' },
  { label: 'Splitter Height:',  key: 'splitterHeight' },
];

const REAR_AXLE_FIELDS: RowField[] = [
  { label: 'Wing:',            key: 'wing' },
  { label: 'Friction Faces:',  key: 'frictionFaces' },
  { label: 'Diff Preload:',    key: 'diffPreload' },
  { label: 'ARB:',             key: 'arb' },
];

const ELECTRONICS_FIELDS: RowField[] = [
  { label: 'ABS:',         key: 'abs' },
  { label: 'TC:',          key: 'tc' },
  { label: 'Brake-Bias:',  key: 'brakeBias' },
  { label: 'Gear Stack:',  key: 'gearStack' },
];

const BRAKES_FIELDS: RowField[] = [
  { label: 'Front Master Cylinder:', key: 'frontMasterCyl' },
  { label: 'Rear Master Cylinder:',  key: 'rearMasterCyl' },
  { label: 'Brake Pads:',            key: 'brakePads' },
];

// Axle-based dampers (the common case — shown as their own cards, not
// duplicated into corner cards). Cars with real per-corner damper data
// (Mercedes) instead get these rows folded into each CornerCard directly.
function getDampers(setup: Record<string, unknown>, axle: Axle) {
  return {
    // Lamborghini has no LS/HS split — just a single Compression/Rebound value.
    lsComp: getAny(setup, [['Dampers', axle, 'LowSpeedCompressionDamping'], ['Dampers', axle, 'CompressionDamping']]),
    hsComp: get(setup, ['Dampers', axle, 'HighSpeedCompressionDamping']),
    lsRbd:  getAny(setup, [['Dampers', axle, 'LowSpeedReboundDamping'], ['Dampers', axle, 'ReboundDamping']]),
    hsRbd:  get(setup, ['Dampers', axle, 'HighSpeedReboundDamping']),
  };
}

const DAMPER_FIELDS_LS_HS: RowField[] = [
  { label: 'LS COMP:', key: 'lsComp' },
  { label: 'HS COMP:', key: 'hsComp' },
  { label: 'LS RBD:',  key: 'lsRbd' },
  { label: 'HS RBD:',  key: 'hsRbd' },
];

// Lamborghini has no LS/HS split (just Compression/Rebound) — lsComp/lsRbd
// already carry that single value via getDampers' fallback, so reuse them
// under plain labels instead of showing an always-empty HS row.
const DAMPER_FIELDS_SIMPLE: RowField[] = [
  { label: 'COMP:', key: 'lsComp' },
  { label: 'RBD:',  key: 'lsRbd' },
];

function damperFieldsFor(data: { hsComp: string; hsRbd: string }[]): RowField[] {
  const hasHs = data.some((d) => d.hsComp !== '—' || d.hsRbd !== '—');
  return hasHs ? DAMPER_FIELDS_LS_HS : DAMPER_FIELDS_SIMPLE;
}

// Coilover shock glyph: two eyelets + spring coil + damper body, angled diagonally.
function DamperGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" className="text-accent shrink-0">
      <g transform="rotate(45 8 8)" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <circle cx="8" cy="2" r="1.6" />
        <path d="M8 3.6 L6.3 4.6 L9.7 5.8 L6.3 7 L8 8" />
        <rect x="6" y="8" width="4" height="6" rx="1.5" />
        <circle cx="8" cy="14" r="1.6" />
      </g>
    </svg>
  );
}

// ── Corner card ───────────────────────────────────────────────────────────────
// Header: corner name + "REF"/"LAP" column labels (colored). Rows: label,
// value per entry (split from its unit), unit trailing. Mirrors the reference
// mockup's table-card layout.

const CORNER_FIELDS: { label: string; key: keyof CornerData }[] = [
  { label: 'Ride Height:',      key: 'rideHeight' },
  { label: 'Bump Rubber Gap:',  key: 'bumpRubberGap' },
  { label: 'Spring:',           key: 'springRate' },
  { label: 'Camber:',           key: 'camber' },
  { label: 'Toe-In:',           key: 'toeIn' },
  { label: 'LS Comp:',          key: 'lsComp' },
  { label: 'HS Comp:',          key: 'hsComp' },
  { label: 'LS Rbd:',           key: 'lsRbd' },
  { label: 'HS Rbd:',           key: 'hsRbd' },
];

const ENTRY_LABELS = ['REF', 'LAP'];

// ── Shared card-table renderer ────────────────────────────────────────────────
// Each data row is its own rounded "pill" with a darker background, aligned to
// the header via CSS subgrid so columns stay pixel-aligned across rows.

interface RowField { label: string; key: string }

function CardTable({
  title, titleIcon, fields, data, colors,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  fields: RowField[];
  data: Record<string, string | null>[];
  colors: string[];
}) {
  const multi = data.length > 1;
  const cols  = multi ? 'auto 1fr auto 1fr auto' : 'auto 1fr auto';

  return (
    <div className="bg-surface-2 border border-border rounded-lg w-full" style={{ padding: 'clamp(0.5rem, 1cqw, 1rem)' }}>
      <div
        className="grid font-mono"
        style={{ gridTemplateColumns: cols, columnGap: 'clamp(0.5rem, 1cqw, 1rem)', rowGap: 'clamp(0.25rem, 0.5cqw, 0.5rem)', fontSize: 'clamp(10px, 0.9cqw, 15px)' }}
      >
        {/* Header row — plain, no pill background */}
        <span className="flex items-center gap-1.5 text-accent font-bold uppercase tracking-widest whitespace-nowrap" style={{ fontSize: 'clamp(11px, 1cqw, 16px)' }}>
          {titleIcon}
          {title}
        </span>
        {multi ? (
          <>
            <span className="text-center font-bold uppercase tracking-wider" style={{ color: colors[0], fontSize: 'clamp(9px, 0.8cqw, 13px)' }}>{ENTRY_LABELS[0]}</span>
            <span />
            <span className="text-center font-bold uppercase tracking-wider" style={{ color: colors[1], fontSize: 'clamp(9px, 0.8cqw, 13px)' }}>{ENTRY_LABELS[1]}</span>
          </>
        ) : (
          <span className="text-center font-bold uppercase tracking-wider" style={{ color: colors[0], fontSize: 'clamp(9px, 0.8cqw, 13px)' }}>{ENTRY_LABELS[0]}</span>
        )}
        <span />

        {/* Data rows — each its own rounded pill via CSS subgrid. LAP value is
            colored (colors[1]) when it differs from REF; REF stays neutral. */}
        {fields.map(({ label, key }) => {
          const raw0 = data[0]?.[key] ?? '—';
          const { value: v0, unit } = splitValueUnit(raw0 ?? '—');
          const raw1   = multi ? (data[1]?.[key] ?? '—') : null;
          const v1     = raw1 != null ? splitValueUnit(raw1).value : null;
          const differs = multi && v0 !== v1;

          return (
            <div
              key={key}
              className="items-center rounded-md"
              style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: 'subgrid',
                background: 'rgba(0,0,0,0.28)',
                padding: 'clamp(3px, 0.4cqw, 8px) clamp(6px, 0.6cqw, 10px)',
              } as React.CSSProperties}
            >
              <span className="text-muted">{label}</span>
              <span className="text-center text-text tabular-nums">{v0}</span>
              {multi && <span className="text-muted text-center">→</span>}
              {multi && (
                <span
                  className="text-center tabular-nums"
                  style={{ color: differs ? colors[1] : 'var(--color-text)' }}
                >
                  {v1}
                </span>
              )}
              <span className="text-muted text-center">{unit || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NULLABLE_CORNER_FIELDS = new Set<keyof CornerData>(['toeIn', 'lsComp', 'hsComp', 'lsRbd', 'hsRbd']);

function CornerCard({ title, data, colors }: { title: string; data: CornerData[]; colors: string[] }) {
  const fields = CORNER_FIELDS.filter(
    (f) => !NULLABLE_CORNER_FIELDS.has(f.key) || data.some((d) => d[f.key] != null),
  );
  return (
    <CardTable
      title={title}
      fields={fields}
      data={data as unknown as Record<string, string | null>[]}
      colors={colors}
    />
  );
}

// ── Car silhouette ────────────────────────────────────────────────────────────

function CarSilhouette() {
  return (
    <svg viewBox="0 0 110 216" className="text-border shrink-0" style={{ width: 'clamp(120px, 13cqw, 260px)', height: 'auto' }}>
      <rect x="18" y="8" width="74" height="184" rx="22" fill="var(--color-surface-2)" stroke="currentColor" strokeWidth="2" />
      {/* wheels, labeled with their corner */}
      <rect x="2"  y="26"  width="14" height="32" rx="4" fill="currentColor" />
      <text x="9" y="42" fontSize="7" fontWeight="bold" fill="var(--color-text)" textAnchor="middle" dominantBaseline="middle" transform="rotate(-90 9 42)">LF</text>
      <rect x="94" y="26"  width="14" height="32" rx="4" fill="currentColor" />
      <text x="101" y="42" fontSize="7" fontWeight="bold" fill="var(--color-text)" textAnchor="middle" dominantBaseline="middle" transform="rotate(-90 101 42)">RF</text>
      <rect x="2"  y="142" width="14" height="32" rx="4" fill="currentColor" />
      <text x="9" y="158" fontSize="7" fontWeight="bold" fill="var(--color-text)" textAnchor="middle" dominantBaseline="middle" transform="rotate(-90 9 158)">LR</text>
      <rect x="94" y="142" width="14" height="32" rx="4" fill="currentColor" />
      <text x="101" y="158" fontSize="7" fontWeight="bold" fill="var(--color-text)" textAnchor="middle" dominantBaseline="middle" transform="rotate(-90 101 158)">RR</text>
      {/* cockpit hint */}
      <rect x="34" y="70" width="42" height="60" rx="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {/* rear wing */}
      <rect x="10" y="204" width="90" height="8" rx="2" fill="var(--color-surface-2)" stroke="currentColor" strokeWidth="2" />
      <line x1="45" y1="192" x2="45" y2="204" stroke="currentColor" strokeWidth="2" />
      <line x1="65" y1="192" x2="65" y2="204" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CarDiagram({ entries, toolbar }: { entries: SetupEntry[]; toolbar?: React.ReactNode }) {
  const setups = entries.map((e) => e.session.setup as Record<string, unknown>);
  const colors = entries.map((e) => e.color);

  const lf = setups.map((s) => getCorner(s, 'LeftFront'));
  const rf = setups.map((s) => getCorner(s, 'RightFront'));
  const lr = setups.map((s) => getCorner(s, 'LeftRear'));
  const rr = setups.map((s) => getCorner(s, 'RightRear'));

  const frontAxle    = setups.map(getFrontAxle);
  const rearAxle     = setups.map(getRearAxle);
  const electronics  = setups.map(getElectronics);
  const brakes       = setups.map(getBrakes);

  // Axle-level damper cards only for cars without real per-corner damper data
  // (the corner cards already fold dampers in for those, e.g. Mercedes).
  const showAxleDampers = !setups.some(hasCornerDampers);
  const fd = showAxleDampers ? setups.map((s) => getDampers(s, 'FrontDampers')) : [];
  const rd = showAxleDampers ? setups.map((s) => getDampers(s, 'RearDampers'))  : [];

  const asRecord = (d: unknown[]) => d as unknown as Record<string, string | null>[];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar row — fixed (non-responsive) padding so it lines up pixel-for-pixel
          with the Table view's toggle row regardless of container width. */}
      <div className="flex items-center gap-6 font-mono text-xs shrink-0 border-b border-border px-3 pt-3 pb-3 w-full">
        {toolbar}
        <div className="flex items-center gap-6 flex-1 justify-center">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
            <span className="font-bold uppercase tracking-wider" style={{ color: e.color }}>
              {ENTRY_LABELS[i]}
            </span>
            <span className="text-muted">·</span>
            <span className="text-text">{e.label}</span>
            {e.session.meta.driver_name && (
              <>
                <span className="text-muted">·</span>
                <span className="text-muted">{e.session.meta.driver_name}</span>
              </>
            )}
            {e.session.meta.setup_name && (
              <>
                <span className="text-muted">·</span>
                <span className="text-accent" title={e.session.meta.setup_name}>{e.session.meta.setup_name}</span>
              </>
            )}
          </div>
        ))}
        </div>
      </div>

      {/* Responsive content area — scales via container query units against
          its own box, independent of the fixed-padding toolbar row above. */}
      <div
        className="flex-1 flex flex-col items-stretch overflow-auto"
        style={{
          gap: 'clamp(0.75rem, 2vh, 1.5rem)',
          padding: 'clamp(0.75rem, 2vw, 1.5rem)',
          containerType: 'inline-size',
        } as React.CSSProperties}
      >
      {/* 3 columns × 4 rows as a real CSS grid — row1: electronics/front/frontDamper,
          row2: leftFront/car/rightFront, row3: leftRear/car/rightRear,
          row4: brakes/rear/rearDamper — so left/right cards' top edges align
          per row regardless of how many fields each card happens to have. */}
      <div
        className="grid items-start w-fit mx-auto"
        style={{
          gridTemplateColumns: 'minmax(0, clamp(220px, 26cqw, 480px)) auto minmax(0, clamp(220px, 26cqw, 480px))',
          columnGap: 'clamp(0.75rem, 2cqw, 2rem)',
          rowGap: 'clamp(0.5rem, 1.5vh, 1.25rem)',
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1 }}>
          <CardTable title="ELECTRONICS" fields={ELECTRONICS_FIELDS} data={asRecord(electronics)} colors={colors} />
        </div>
        <div style={{ gridColumn: 1, gridRow: 2 }}>
          <CornerCard title="LEFT FRONT" data={lf} colors={colors} />
        </div>
        <div style={{ gridColumn: 1, gridRow: 3 }}>
          <CornerCard title="LEFT REAR" data={lr} colors={colors} />
        </div>
        <div style={{ gridColumn: 1, gridRow: 4 }}>
          <CardTable title="BRAKES" fields={BRAKES_FIELDS} data={asRecord(brakes)} colors={colors} />
        </div>

        <div style={{ gridColumn: 2, gridRow: 1 }}>
          <CardTable title="FRONT" fields={FRONT_AXLE_FIELDS} data={asRecord(frontAxle)} colors={colors} />
        </div>
        <div style={{ gridColumn: 2, gridRow: '2 / 4', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CarSilhouette />
        </div>
        <div style={{ gridColumn: 2, gridRow: 4 }}>
          <CardTable title="REAR" fields={REAR_AXLE_FIELDS} data={asRecord(rearAxle)} colors={colors} />
        </div>

        {showAxleDampers && (
          <div style={{ gridColumn: 3, gridRow: 1 }}>
            <CardTable title="FRONT DAMPER" titleIcon={<DamperGlyph />} fields={damperFieldsFor(fd)} data={asRecord(fd)} colors={colors} />
          </div>
        )}
        <div style={{ gridColumn: 3, gridRow: 2 }}>
          <CornerCard title="RIGHT FRONT" data={rf} colors={colors} />
        </div>
        <div style={{ gridColumn: 3, gridRow: 3 }}>
          <CornerCard title="RIGHT REAR" data={rr} colors={colors} />
        </div>
        {showAxleDampers && (
          <div style={{ gridColumn: 3, gridRow: 4 }}>
            <CardTable title="REAR DAMPER" titleIcon={<DamperGlyph />} fields={damperFieldsFor(rd)} data={asRecord(rd)} colors={colors} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
