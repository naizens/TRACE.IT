import type { Tab } from '../store/useStore';

export const TABS_BEFORE: { id: Tab; label: string }[] = [
  { id: 'driving',   label: 'Driving'   },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'damper',    label: 'Damper'    },
];

export const TABS_AFTER: { id: Tab; label: string }[] = [
  { id: 'rideheight', label: 'Ride Heights' },
  { id: 'tiretemp',   label: 'Tire Temps'   },
  { id: 'setup',      label: 'Car Setup'    },
];

export const SHOCK_TABS: { id: Tab; label: string }[] = [
  { id: 'shocks',   label: 'Deflection' },
  { id: 'shockvel', label: 'Velocity'   },
];
