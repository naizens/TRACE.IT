/// <reference types="vite/client" />

import type { ParsedSession } from './types/session';

interface WindowControls {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (isMax: boolean) => void) => () => void;
}

interface ElectronAPI {
  openIbtFiles: () => Promise<ParsedSession[] | null>;
  platform: string;
  windowControls: WindowControls;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Allow React inline styles to accept the Electron drag region property
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag' | 'inherit';
  }
}
