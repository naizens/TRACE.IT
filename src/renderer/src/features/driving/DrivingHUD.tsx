import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { TelemetryBarHandle, TelemetryInputs } from '../trackmap/TelemetryBar';

export type { TelemetryBarHandle };

function gearLabel(g: number): string {
  if (g === -1) return 'R';
  if (g === 0)  return 'N';
  return String(g);
}

function WheelSvg({ r }: { r: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={r} viewBox="0 0 20 20" width="32" height="32" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: 'rotate(0deg)', transformOrigin: 'center', flexShrink: 0, color: '#52525b' }}>
      <g clipPath="url(#sw-clip)">
        <path d="M10 19C14.9706 19 19 14.9706 19 10C19 5.02944 14.9706 1 10 1C5.02944 1 1 5.02944 1 10C1 14.9706 5.02944 19 10 19Z" stroke="currentColor" strokeWidth="2"/>
        <path d="M10 19V10" stroke="currentColor" strokeWidth="2"/>
        <path d="M19 10H1" stroke="currentColor" strokeWidth="2"/>
        <mask id="sw-mask-1" fill="white">
          <path d="M14 9C13.3434 9 12.6932 9.12933 12.0866 9.3806C11.48 9.63188 10.9288 10.0002 10.4645 10.4645C10.0002 10.9288 9.63188 11.48 9.3806 12.0866C9.12933 12.6932 9 13.3434 9 14L10.9501 14C10.9501 13.5995 11.029 13.2029 11.1823 12.8329C11.3356 12.4628 11.5602 12.1266 11.8434 11.8434C12.1266 11.5602 12.4628 11.3356 12.8329 11.1823C13.2029 11.029 13.5995 10.9501 14 10.9501L14 9Z"/>
        </mask>
        <path d="M14 9C13.3434 9 12.6932 9.12933 12.0866 9.3806C11.48 9.63188 10.9288 10.0002 10.4645 10.4645C10.0002 10.9288 9.63188 11.48 9.3806 12.0866C9.12933 12.6932 9 13.3434 9 14L10.9501 14C10.9501 13.5995 11.029 13.2029 11.1823 12.8329C11.3356 12.4628 11.5602 12.1266 11.8434 11.8434C12.1266 11.5602 12.4628 11.3356 12.8329 11.1823C13.2029 11.029 13.5995 10.9501 14 10.9501L14 9Z" stroke="currentColor" strokeWidth="4" mask="url(#sw-mask-1)"/>
        <mask id="sw-mask-2" fill="white">
          <path d="M11 14C11 13.3434 10.8707 12.6932 10.6194 12.0866C10.3681 11.48 9.99983 10.9288 9.53553 10.4645C9.07124 10.0002 8.52004 9.63188 7.91342 9.3806C7.30679 9.12933 6.65661 9 6 9L6 10.9501C6.40051 10.9501 6.79711 11.029 7.16713 11.1823C7.53716 11.3356 7.87337 11.5602 8.15658 11.8434C8.43978 12.1266 8.66444 12.4628 8.81771 12.8329C8.97098 13.2029 9.04986 13.5995 9.04986 14H11Z"/>
        </mask>
        <path d="M11 14C11 13.3434 10.8707 12.6932 10.6194 12.0866C10.3681 11.48 9.99983 10.9288 9.53553 10.4645C9.07124 10.0002 8.52004 9.63188 7.91342 9.3806C7.30679 9.12933 6.65661 9 6 9L6 10.9501C6.40051 10.9501 6.79711 11.029 7.16713 11.1823C7.53716 11.3356 7.87337 11.5602 8.15658 11.8434C8.43978 12.1266 8.66444 12.4628 8.81771 12.8329C8.97098 13.2029 9.04986 13.5995 9.04986 14H11Z" stroke="currentColor" strokeWidth="4" mask="url(#sw-mask-2)"/>
        <path d="M11.1163 1.0695C10.3728 0.976557 9.62053 0.976836 8.87706 1.07033" stroke="#ffffff" strokeWidth="2"/>
      </g>
      <defs>
        <clipPath id="sw-clip">
          <rect width="20" height="20" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

interface SlotRefs {
  tBar:  React.RefObject<HTMLSpanElement | null>;
  bBar:  React.RefObject<HTMLSpanElement | null>;
  tNum:  React.RefObject<HTMLSpanElement | null>;
  bNum:  React.RefObject<HTMLSpanElement | null>;
  gear:  React.RefObject<HTMLSpanElement | null>;
  spd:   React.RefObject<HTMLSpanElement | null>;
  wheel: React.RefObject<SVGSVGElement | null>;
}

function applySlot(refs: SlotRefs, inp: TelemetryInputs) {
  if (refs.tBar.current)  refs.tBar.current.style.width  = `${inp.throttle}%`;
  if (refs.bBar.current)  refs.bBar.current.style.width  = `${inp.brake}%`;
  if (refs.tNum.current)  refs.tNum.current.textContent  = `${inp.throttle}%`;
  if (refs.bNum.current)  refs.bNum.current.textContent  = `${inp.brake}%`;
  if (refs.gear.current)  refs.gear.current.textContent  = gearLabel(inp.gear);
  if (refs.spd.current)   refs.spd.current.textContent   = `${inp.speedKph.toFixed(1)} km/h`;
  if (refs.wheel.current) {
    refs.wheel.current.style.transform       = `rotate(${-inp.steerDeg}deg)`;
    refs.wheel.current.style.transformOrigin = 'center';
    if (inp.lapColor) refs.wheel.current.style.color = inp.lapColor;
  }
}

// Left slot: wheel LEFT → bars side-by-side → gear → speed
function LeftSlot({ refs }: { refs: SlotRefs }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <WheelSvg r={refs.wheel} />

      {/* GAS + BRK side by side */}
      <div className="flex gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="flex-1 h-2 bg-surface-2 rounded overflow-hidden">
            <span ref={refs.tBar} style={{ width: '0%', height: '100%', backgroundColor: '#22c55e', display: 'block', transition: 'width 60ms linear' }} />
          </div>
          <span ref={refs.tNum} className="text-[9px] font-black tabular-nums shrink-0" style={{ color: '#22c55e', width: 26, textAlign: 'right' }}>0%</span>
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="flex-1 h-2 bg-surface-2 rounded overflow-hidden">
            <span ref={refs.bBar} style={{ width: '0%', height: '100%', backgroundColor: '#ef4444', display: 'block', transition: 'width 60ms linear' }} />
          </div>
          <span ref={refs.bNum} className="text-[9px] font-black tabular-nums shrink-0" style={{ color: '#ef4444', width: 26, textAlign: 'right' }}>0%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span ref={refs.gear} className="text-xl font-black text-text tabular-nums leading-none" style={{ minWidth: 14 }}>N</span>
        <span ref={refs.spd} className="text-[11px] font-bold text-muted tabular-nums">0.0 km/h</span>
      </div>
    </div>
  );
}

// Right slot: speed → gear → bars side-by-side → wheel RIGHT (fully mirrored)
function RightSlot({ refs }: { refs: SlotRefs }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
      <WheelSvg r={refs.wheel} />

      {/* GAS + BRK side by side (mirrored: BRK first, then GAS, bars grow right→left) */}
      <div className="flex gap-2 flex-1 min-w-0 flex-row-reverse">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-row-reverse">
          <div className="flex-1 h-2 bg-surface-2 rounded overflow-hidden" style={{ transform: 'scaleX(-1)' }}>
            <span ref={refs.tBar} style={{ width: '0%', height: '100%', backgroundColor: '#22c55e', display: 'block', transition: 'width 60ms linear' }} />
          </div>
          <span ref={refs.tNum} className="text-[9px] font-black tabular-nums shrink-0" style={{ color: '#22c55e', width: 26 }}>0%</span>
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-row-reverse">
          <div className="flex-1 h-2 bg-surface-2 rounded overflow-hidden" style={{ transform: 'scaleX(-1)' }}>
            <span ref={refs.bBar} style={{ width: '0%', height: '100%', backgroundColor: '#ef4444', display: 'block', transition: 'width 60ms linear' }} />
          </div>
          <span ref={refs.bNum} className="text-[9px] font-black tabular-nums shrink-0" style={{ color: '#ef4444', width: 26 }}>0%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-row-reverse">
        <span ref={refs.gear} className="text-xl font-black text-text tabular-nums leading-none" style={{ minWidth: 14 }}>N</span>
        <span ref={refs.spd} className="text-[11px] font-bold text-muted tabular-nums">0.0 km/h</span>
      </div>
    </div>
  );
}

export const DrivingHUD = forwardRef<TelemetryBarHandle>((_, ref) => {
  const slot1WrapRef = useRef<HTMLDivElement>(null);

  const s0: SlotRefs = {
    tBar: useRef(null), bBar: useRef(null),
    tNum: useRef(null), bNum: useRef(null), gear: useRef(null),
    spd: useRef(null), wheel: useRef(null),
  };
  const s1: SlotRefs = {
    tBar: useRef(null), bBar: useRef(null),
    tNum: useRef(null), bNum: useRef(null), gear: useRef(null),
    spd: useRef(null), wheel: useRef(null),
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
    <div className="flex items-center px-3 min-h-0 select-none pointer-events-none" style={{ height: 44 }}>
      <LeftSlot refs={s0} />
      <div ref={slot1WrapRef} className="items-center" style={{ display: 'none', gap: 0, flex: 1 }}>
        <div className="w-px bg-border self-stretch mx-3 shrink-0" style={{ marginTop: 8, marginBottom: 8 }} />
        <RightSlot refs={s1} />
      </div>
    </div>
  );
});

DrivingHUD.displayName = 'DrivingHUD';
