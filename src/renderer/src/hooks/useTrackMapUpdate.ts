import { useCallback } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../store/useStore';
import { COLOR_ORDER } from '../lib/constants';
import type { TrackMapHandle } from '../features/trackmap';

/**
 * Returns an `onMapUpdate(lapDist)` callback that reads telemetry from the
 * highest-priority selected lap (ref > blue > pink > lime) and forwards it
 * to the track-map overlay as `TelemetryInputs`.
 *
 * This ensures the overlay always reflects the same lap the user is hovering
 * on in the charts, rather than the dead-reckoning reference lap baked into
 * the track map itself.
 */
export function useTrackMapUpdate(trackMapRef: RefObject<TrackMapHandle>) {
  return useCallback(
    (lapDist: number) => {
      const { sessions, selections } = useStore.getState();

      // Find the highest-priority selected lap
      let refKey: string | null = null;
      for (const color of COLOR_ORDER) {
        const found = Object.keys(selections).find((k) => selections[k] === color);
        if (found) { refKey = found; break; }
      }

      if (!refKey) {
        trackMapRef.current?.updateMarker(lapDist);
        return;
      }

      const colon      = refKey.indexOf(':');
      const sessionIdx = parseInt(refKey.substring(0, colon));
      const lapIdx     = parseInt(refKey.substring(colon + 1));
      const sess       = sessions[sessionIdx];
      const lap        = sess?.laps[lapIdx];

      if (!sess || !lap) {
        trackMapRef.current?.updateMarker(lapDist);
        return;
      }

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

      trackMapRef.current?.updateMarker(lapDist, {
        throttle: Math.round((d['Throttle']?.[idx] ?? 0) * 100),
        brake:    Math.round((d['Brake']?.[idx]    ?? 0) * 100),
        gear:     d['Gear']?.[idx] ?? 0,
        speedKph: Math.round((d['Speed']?.[idx]    ?? 0) * 3.6),
        steerDeg: d['SteeringWheelAngle']?.[idx]   ?? 0,
      });
    },
    [trackMapRef],
  );
}
