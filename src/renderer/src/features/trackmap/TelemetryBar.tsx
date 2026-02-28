import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface TelemetryInputs {
  throttle: number;  // 0-100
  brake:    number;  // 0-100
  gear:     number;
  speedKph: number;
  steerDeg: number;
}

export interface TelemetryBarHandle {
  update: (inputs: TelemetryInputs) => void;
}

function gearLabel(g: number): string {
  if (g === -1) return 'R';
  if (g === 0)  return 'N';
  return String(g);
}

export const TelemetryBar = forwardRef<TelemetryBarHandle>((_, ref) => {
  const throttleRef = useRef<HTMLSpanElement>(null);
  const brakeRef    = useRef<HTMLSpanElement>(null);
  const gearRef     = useRef<HTMLSpanElement>(null);
  const speedRef    = useRef<HTMLSpanElement>(null);
  const wheelRef    = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    update({ throttle, brake, gear, speedKph, steerDeg }: TelemetryInputs) {
      if (throttleRef.current) throttleRef.current.textContent = String(throttle);
      if (brakeRef.current)    brakeRef.current.textContent    = String(brake);
      if (gearRef.current)     gearRef.current.textContent     = gearLabel(gear);
      if (speedRef.current)    speedRef.current.textContent    = String(speedKph);
      if (wheelRef.current) {
        wheelRef.current.style.transform       = `rotate(${-steerDeg}deg)`;
        wheelRef.current.style.transformOrigin = 'center';
      }
    },
  }), []);

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border rounded shrink-0 pointer-events-none select-none">

      {/* Throttle + Brake */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 w-7">
        <span
          ref={throttleRef}
          className="text-[11px] font-black leading-none"
          style={{ color: '#00ff88' }}
        >0</span>
        <span
          ref={brakeRef}
          className="text-[11px] font-black leading-none"
          style={{ color: '#ef4444' }}
        >0</span>
      </div>

      {/* Gear + Speed */}
      <div className="flex-1 flex flex-col items-center leading-none">
        <span ref={gearRef} className="text-text font-black" style={{ fontSize: 22 }}>N</span>
        <div className="flex items-baseline gap-0.5">
          <span ref={speedRef} className="text-text font-bold text-sm">0</span>
          <span className="text-muted" style={{ fontSize: 8 }}>km/h</span>
        </div>
      </div>

      {/* Steering wheel */}
      <div className="shrink-0 w-10 h-10 flex items-center justify-center">
        <svg
          ref={wheelRef}
          viewBox="-10 -10 20 20"
          width="40"
          height="40"
          style={{ transform: 'rotate(0deg)', transformOrigin: 'center' }}
        >
          {/* Rim */}
          <circle cx="0" cy="0" r="9" fill="transparent" stroke="#3f3f46" strokeWidth="2" />
          {/* Bottom spoke */}
          <line x1="0" y1="9" x2="0" y2="0" stroke="#3f3f46" strokeWidth="2" />
          {/* Crossbar */}
          <line x1="-9" y1="0" x2="9" y2="0" stroke="#3f3f46" strokeWidth="2" />
          {/* Top indicator dot */}
          <circle cx="0" cy="-9" r="1.8" fill="#f59e0b" />
        </svg>
      </div>

    </div>
  );
});

TelemetryBar.displayName = 'TelemetryBar';
