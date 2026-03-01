import { useCallback } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../store/useStore';
import { COLOR_ORDER, LAP_COLORS } from '../lib/constants';
import type { TrackMapHandle, TelemetryInputs } from '../features/trackmap';

/**
 * Returns an `onMapUpdate(lapDist)` callback that reads telemetry from the
 * top two priority-selected laps and forwards both to the TelemetryBar.
 * Priority order: ref > blue > pink > lime.
 */
export function useTrackMapUpdate(trackMapRef: RefObject<TrackMapHandle>) {
  return useCallback(
    (lapDist: number) => {
      const { sessions, selections } = useStore.getState();

      // Collect the top 2 selected lap keys in priority order
      const selectedKeys: string[] = [];
      for (const color of COLOR_ORDER) {
        const found = Object.keys(selections).find((k) => selections[k] === color);
        if (found) {
          selectedKeys.push(found);
          if (selectedKeys.length === 2) break;
        }
      }

      if (selectedKeys.length === 0) {
        trackMapRef.current?.updateMarker(lapDist);
        return;
      }

      const inputs: TelemetryInputs[] = [];

      for (const key of selectedKeys) {
        const colon      = key.indexOf(':');
        const sessionIdx = parseInt(key.substring(0, colon));
        const lapIdx     = parseInt(key.substring(colon + 1));
        const sess       = sessions[sessionIdx];
        const lap        = sess?.laps[lapIdx];

        if (!sess || !lap) continue;

        const d       = sess.data;
        const distArr = d['LapDist'] ?? [];
        const { start_idx: s, end_idx: e } = lap;

        // Binary search within the lap slice
        let lo = s, hi = e;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (distArr[m] < lapDist) lo = m + 1; else hi = m;
        }
        const idx = lo;

        inputs.push({
          throttle: Math.round((d['Throttle']?.[idx] ?? 0) * 100),
          brake:    Math.round((d['Brake']?.[idx]    ?? 0) * 100),
          gear:     d['Gear']?.[idx] ?? 0,
          speedKph: Math.round((d['Speed']?.[idx]    ?? 0) * 3.6),
          steerDeg: d['SteeringWheelAngle']?.[idx]   ?? 0,
          lapColor: LAP_COLORS[selections[key]],
        });
      }

      trackMapRef.current?.updateMarker(lapDist, inputs);
    },
    [trackMapRef],
  );
}
