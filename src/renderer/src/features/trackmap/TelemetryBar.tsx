import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface TelemetryInputs {
  throttle: number;  // 0-100
  brake:    number;  // 0-100
  gear:     number;
  speedKph: number;
  steerDeg: number;
  lapColor?: string;
  delta?: number;    // seconds, cmp minus ref (negative = cmp faster)
}

export interface TelemetryBarHandle {
  update: (inputs: TelemetryInputs[]) => void;
}

function gearLabel(g: number): string {
  if (g === -1) return 'R';
  if (g === 0)  return 'N';
  return String(g);
}

const WHEEL_SVG_STROKE = '#3f3f46';

export const TelemetryBar = forwardRef<TelemetryBarHandle>((_, ref) => {
  // ── Slot 0 refs ──────────────────────────────────────────────────────────
  const dot0Ref    = useRef<HTMLSpanElement>(null);
  const t0Bar      = useRef<HTMLSpanElement>(null);
  const b0Bar      = useRef<HTMLSpanElement>(null);
  const t0Num      = useRef<HTMLSpanElement>(null);
  const b0Num      = useRef<HTMLSpanElement>(null);
  const g0Ref      = useRef<HTMLSpanElement>(null);
  const s0Ref      = useRef<HTMLSpanElement>(null);
  const wheel0Ref  = useRef<SVGSVGElement>(null);

  // ── Slot 1 refs ──────────────────────────────────────────────────────────
  const slot1Ref   = useRef<HTMLDivElement>(null);
  const dot1Ref    = useRef<HTMLSpanElement>(null);
  const t1Bar      = useRef<HTMLSpanElement>(null);
  const b1Bar      = useRef<HTMLSpanElement>(null);
  const t1Num      = useRef<HTMLSpanElement>(null);
  const b1Num      = useRef<HTMLSpanElement>(null);
  const g1Ref      = useRef<HTMLSpanElement>(null);
  const s1Ref      = useRef<HTMLSpanElement>(null);
  const wheel1Ref  = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    update(inputs: TelemetryInputs[]) {
      const a = inputs[0];
      if (a) {
        if (dot0Ref.current && a.lapColor)  dot0Ref.current.style.backgroundColor  = a.lapColor;
        if (t0Bar.current)  t0Bar.current.style.height  = `${a.throttle}%`;
        if (b0Bar.current)  b0Bar.current.style.height  = `${a.brake}%`;
        if (t0Num.current)  t0Num.current.textContent   = String(a.throttle);
        if (b0Num.current)  b0Num.current.textContent   = String(a.brake);
        if (g0Ref.current)  g0Ref.current.textContent   = gearLabel(a.gear);
        if (s0Ref.current)  s0Ref.current.textContent   = String(a.speedKph);
        if (wheel0Ref.current) {
          wheel0Ref.current.style.transform       = `rotate(${-a.steerDeg}deg)`;
          wheel0Ref.current.style.transformOrigin = 'center';
        }
      }

      const b = inputs[1];
      if (slot1Ref.current) slot1Ref.current.style.display = b ? 'flex' : 'none';
      if (b) {
        if (dot1Ref.current && b.lapColor)  dot1Ref.current.style.backgroundColor  = b.lapColor;
        if (t1Bar.current)  t1Bar.current.style.height  = `${b.throttle}%`;
        if (b1Bar.current)  b1Bar.current.style.height  = `${b.brake}%`;
        if (t1Num.current)  t1Num.current.textContent   = String(b.throttle);
        if (b1Num.current)  b1Num.current.textContent   = String(b.brake);
        if (g1Ref.current)  g1Ref.current.textContent   = gearLabel(b.gear);
        if (s1Ref.current)  s1Ref.current.textContent   = String(b.speedKph);
        if (wheel1Ref.current) {
          wheel1Ref.current.style.transform       = `rotate(${-b.steerDeg}deg)`;
          wheel1Ref.current.style.transformOrigin = 'center';
        }
      }
    },
  }), []);

  return (
    <div className="flex items-center justify-between w-full px-2 py-1.5 bg-surface-2 border border-border rounded pointer-events-none select-none">

      {/* ── Slot 0 ────────────────────────────────────────────────────────── */}
      <div className="flex items-end gap-0.5">
        <span
          ref={dot0Ref}
          style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#52525b', display: 'block', flexShrink: 0, marginBottom: 3 }}
        />
        <div className="flex flex-col items-center gap-0.5 w-4">
          <div className="w-3 h-9 bg-surface rounded-sm overflow-hidden flex items-end">
            <span ref={t0Bar} style={{ width: '100%', height: '0%', backgroundColor: '#00ff88', display: 'block' }} />
          </div>
          <span ref={t0Num} className="text-[9px] font-bold leading-none w-full text-center" style={{ color: '#00ff88' }}>0</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 w-4">
          <div className="w-3 h-9 bg-surface rounded-sm overflow-hidden flex items-end">
            <span ref={b0Bar} style={{ width: '100%', height: '0%', backgroundColor: '#ef4444', display: 'block' }} />
          </div>
          <span ref={b0Num} className="text-[9px] font-bold leading-none w-full text-center" style={{ color: '#ef4444' }}>0</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <svg ref={wheel0Ref} viewBox="-10 -10 20 20" width="36" height="36"
            style={{ transform: 'rotate(0deg)', transformOrigin: 'center', flexShrink: 0 }}>
            <circle cx="0" cy="0" r="9" fill="transparent" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <line x1="0" y1="9" x2="0" y2="0" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <circle cx="0" cy="-9" r="1.8" fill="#f59e0b" />
          </svg>
          <div className="flex items-center gap-1 leading-none">
            <span ref={g0Ref} className="text-text font-black text-[11px]">N</span>
            <span ref={s0Ref} className="text-muted text-[9px] font-bold">0</span>
          </div>
        </div>
      </div>

      {/* ── Slot 1 (hidden until 2nd lap selected) ────────────────────────── */}
      <div ref={slot1Ref} className="items-end gap-0.5" style={{ display: 'none' }}>
        <div className="w-px h-8 bg-border shrink-0 self-center" />
        <span
          ref={dot1Ref}
          style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#52525b', display: 'block', flexShrink: 0, marginBottom: 3 }}
        />
        <div className="flex flex-col items-center gap-0.5 w-4">
          <div className="w-3 h-9 bg-surface rounded-sm overflow-hidden flex items-end">
            <span ref={t1Bar} style={{ width: '100%', height: '0%', backgroundColor: '#00ff88', display: 'block' }} />
          </div>
          <span ref={t1Num} className="text-[9px] font-bold leading-none w-full text-center" style={{ color: '#00ff88' }}>0</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 w-4">
          <div className="w-3 h-9 bg-surface rounded-sm overflow-hidden flex items-end">
            <span ref={b1Bar} style={{ width: '100%', height: '0%', backgroundColor: '#ef4444', display: 'block' }} />
          </div>
          <span ref={b1Num} className="text-[9px] font-bold leading-none w-full text-center" style={{ color: '#ef4444' }}>0</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <svg ref={wheel1Ref} viewBox="-10 -10 20 20" width="36" height="36"
            style={{ transform: 'rotate(0deg)', transformOrigin: 'center', flexShrink: 0 }}>
            <circle cx="0" cy="0" r="9" fill="transparent" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <line x1="0" y1="9" x2="0" y2="0" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke={WHEEL_SVG_STROKE} strokeWidth="2" />
            <circle cx="0" cy="-9" r="1.8" fill="#f59e0b" />
          </svg>
          <div className="flex items-center gap-1 leading-none">
            <span ref={g1Ref} className="text-text font-black text-[11px]">N</span>
            <span ref={s1Ref} className="text-muted text-[9px] font-bold">0</span>
          </div>
        </div>
      </div>

    </div>
  );
});

TelemetryBar.displayName = 'TelemetryBar';
