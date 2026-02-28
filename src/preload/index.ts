import { contextBridge, ipcRenderer } from 'electron';
import type { ParsedSession } from '../main/ibt-parser';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── IBT parsing ─────────────────────────────────────────────────────────
  openIbtFiles: (): Promise<ParsedSession[] | null> =>
    ipcRenderer.invoke('open-ibt-files'),

  parseIbtBuffers: (files: Array<{ name: string; data: ArrayBuffer }>): Promise<ParsedSession[] | null> =>
    ipcRenderer.invoke('parse-ibt-buffers', files),

  platform: process.platform,

  // ── Window controls ─────────────────────────────────────────────────────
  windowControls: {
    minimize: ()                           => ipcRenderer.send('window:minimize'),
    maximize: ()                           => ipcRenderer.send('window:maximize'),
    close:    ()                           => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean>      => ipcRenderer.invoke('window:is-maximized'),
    /** Subscribe to maximize/restore events from main. Returns an unsubscribe fn. */
    onMaximizeChange: (cb: (isMax: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, isMax: boolean) => cb(isMax);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.off('window:maximized', handler);
    },
  },
} satisfies ElectronAPI);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WindowControls {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (isMax: boolean) => void) => () => void;
}

export interface ElectronAPI {
  openIbtFiles: () => Promise<ParsedSession[] | null>;
  parseIbtBuffers: (files: Array<{ name: string; data: ArrayBuffer }>) => Promise<ParsedSession[] | null>;
  platform: string;
  windowControls: WindowControls;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
