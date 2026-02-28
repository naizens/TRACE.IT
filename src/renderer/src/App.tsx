import { useRef } from 'react';
import { useStore } from './store/useStore';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { DropZone } from './components/layout/DropZone';
import { TelemetryView } from './features/telemetry/TelemetryView';
import { SetupView } from './features/setup/SetupView';
import { DamperView } from './features/damper/DamperView';
import { RideHeightView } from './features/rideheight/RideHeightView';
import { TireTempView } from './features/tiretemp/TireTempView';
import { ShocksView } from './features/shocks/ShocksView';
import type { TrackMapHandle } from './features/trackmap';

export function App() {
  const activeTab   = useStore((s) => s.activeTab);
  const sessions    = useStore((s) => s.sessions);
  const trackMapRef = useRef<TrackMapHandle>(null);

  return (
    // Full-screen column: TitleBar on top, content row below
    <div className="flex flex-col h-screen overflow-hidden bg-bg text-text">

      {/* Custom frameless titlebar (drag region + tabs + window controls) */}
      <TitleBar />

      {/* Content row */}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        <Sidebar trackMapRef={trackMapRef} />

        {/* flex flex-col so TelemetryView's flex-1 has a proper flex context */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {activeTab === 'telemetry' && <TelemetryView trackMapRef={trackMapRef} />}
          {activeTab === 'setup'     && <SetupView />}
          {activeTab === 'damper'      && <DamperView />}
          {activeTab === 'shocks'      && <ShocksView     trackMapRef={trackMapRef} />}
          {activeTab === 'rideheight'  && <RideHeightView trackMapRef={trackMapRef} />}
          {activeTab === 'tiretemp'    && <TireTempView   trackMapRef={trackMapRef} />}
        </main>

        {/* Full-area overlay when no files loaded — sits above sidebar */}
        {sessions.length === 0 && <DropZone />}
      </div>

    </div>
  );
}
