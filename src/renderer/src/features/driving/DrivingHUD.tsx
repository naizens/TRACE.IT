import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { TelemetryBarHandle, TelemetryInputs } from '../trackmap/TelemetryBar';

export type { TelemetryBarHandle };

function gearLabel(g: number): string {
  if (g === -1) return 'R';
  if (g === 0)  return 'N';
  return String(g);
}

const WHEEL_STROKE = '#3f3f46';

interface SlotRefs {
  dot:   React.RefObject<HTMLSpanElement | null>;
  tBar:  React.RefObject<HTMLSpanElement | null>;
  bBar:  React.RefObject<HTMLSpanElement | null>;
  tNum:  React.RefObject<HTMLSpanElement | null>;
  bNum:  React.RefObject<HTMLSpanElement | null>;
  gear:  React.RefObject<HTMLSpanElement | null>;
  spd:   React.RefObject<HTMLSpanElement | null>;
  wheel: React.RefObject<SVGSVGElement | null>;
}

function applySlot(refs: SlotRefs, inp: TelemetryInputs) {
  if (refs.dot.current && inp.lapColor) refs.dot.current.style.backgroundColor = inp.lapColor;
  if (refs.tBar.current)  refs.tBar.current.style.height    = `${inp.throttle}%`;
  if (refs.bBar.current)  refs.bBar.current.style.height    = `${inp.brake}%`;
  if (refs.tNum.current)  refs.tNum.current.textContent     = String(inp.throttle);
  if (refs.bNum.current)  refs.bNum.current.textContent     = String(inp.brake);
  if (refs.gear.current)  refs.gear.current.textContent     = gearLabel(inp.gear);
  if (refs.spd.current)   refs.spd.current.textContent      = `${inp.speedKph} km/h`;
  if (refs.wheel.current) {
    refs.wheel.current.style.transform       = `rotate(${-inp.steerDeg}deg)`;
    refs.wheel.current.style.transformOrigin = 'center';
  }
}

function SlotDisplay({ refs, lapColor }: { refs: SlotRefs; lapColor?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 py-4 px-4 overflow-visible">

      {/* Colour dot */}
      <span
        ref={refs.dot}
        style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: lapColor ?? '#52525b', flexShrink: 0 }}
      />

      {/* Throttle + Wheel + Brake — fixed bar height so it never stretches awkwardly */}
      <div className="flex gap-4 items-end w-full justify-center" style={{ height: 180 }}>

        {/* Throttle */}
        <div className="flex flex-col items-center gap-1.5 h-full">
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted shrink-0">Gas</span>
          <div className="flex-1 w-10 bg-surface-2 rounded overflow-hidden flex flex-col justify-end min-h-0">
            <span
              ref={refs.tBar}
              style={{ width: '100%', height: '0%', backgroundColor: '#22c55e', display: 'block', transition: 'height 60ms linear' }}
            />
          </div>
          <span ref={refs.tNum} className="text-sm font-black tabular-nums shrink-0" style={{ color: '#22c55e' }}>0</span>
        </div>

        {/* Steering wheel + Gear + Speed */}
        <div className="flex flex-col items-center justify-end gap-3 self-end pb-6 overflow-visible">
          <svg
            ref={refs.wheel}
            viewBox="-14 -14 28 28"
            width="88" height="88"
            style={{ transform: 'rotate(0deg)', transformOrigin: 'center', flexShrink: 0 }}
          >
            <circle cx="0" cy="0" r="11" fill="transparent" stroke={WHEEL_STROKE} strokeWidth="2.5" />
            <line x1="0"   y1="11"  x2="0"   y2="3.5" stroke={WHEEL_STROKE} strokeWidth="2" />
            <line x1="-11" y1="0"   x2="-3.5" y2="0"  stroke={WHEEL_STROKE} strokeWidth="2" />
            <line x1="11"  y1="0"   x2="3.5"  y2="0"  stroke={WHEEL_STROKE} strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill={WHEEL_STROKE} />
            <circle cx="0" cy="-11" r="2.2" fill="#f59e0b" />
          </svg>
          <div className="flex flex-col items-center gap-0.5">
            <span ref={refs.gear} className="text-4xl font-black text-text leading-none tabular-nums">N</span>
            <span ref={refs.spd} className="text-[11px] font-bold text-muted tabular-nums">0 km/h</span>
          </div>
        </div>

        {/* Brake */}
        <div className="flex flex-col items-center gap-1.5 h-full">
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted shrink-0">Bremse</span>
          <div className="flex-1 w-10 bg-surface-2 rounded overflow-hidden flex flex-col justify-end min-h-0">
            <span
              ref={refs.bBar}
              style={{ width: '100%', height: '0%', backgroundColor: '#ef4444', display: 'block', transition: 'height 60ms linear' }}
            />
          </div>
          <span ref={refs.bNum} className="text-sm font-black tabular-nums shrink-0" style={{ color: '#ef4444' }}>0</span>
        </div>
      </div>
    </div>
  );
}

export const DrivingHUD = forwardRef<TelemetryBarHandle>((_, ref) => {
  const slot1WrapRef = useRef<HTMLDivElement>(null);

  const s0: SlotRefs = {
    dot:   useRef(null), tBar: useRef(null), bBar: useRef(null),
    tNum:  useRef(null), bNum: useRef(null), gear: useRef(null),
    spd:   useRef(null), wheel: useRef(null),
  };
  const s1: SlotRefs = {
    dot:   useRef(null), tBar: useRef(null), bBar: useRef(null),
    tNum:  useRef(null), bNum: useRef(null), gear: useRef(null),
    spd:   useRef(null), wheel: useRef(null),
  };

  useImperativeHandle(ref, () => ({
    update(inputs: TelemetryInputs[]) {
      if (inputs[0]) applySlot(s0, inputs[0]);
      const has1 = Boolean(inputs[1]);
      if (slot1WrapRef.current) slot1WrapRef.current.style.display = has1 ? 'flex' : 'none';
      if (has1) applySlot(s1, inputs[1]!);
    },
  }));

  return (
    <div className="flex-1 flex overflow-visible min-h-0 select-none pointer-events-none">

      {/* Slot 0 — always visible */}
      <SlotDisplay refs={s0} />

      {/* Divider + Slot 1 — shown when 2nd lap selected */}
      <div ref={slot1WrapRef} style={{ display: 'none', flex: 1, flexDirection: 'row', minHeight: 0, overflow: 'visible' }}>
        <div className="w-px bg-border self-stretch my-4 shrink-0" />
        <SlotDisplay refs={s1} />
      </div>

    </div>
  );
});

DrivingHUD.displayName = 'DrivingHUD';
