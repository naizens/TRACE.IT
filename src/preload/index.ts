import { contextBridge, ipcRenderer } from 'electron';
import type { ParsedSession } from '../main/ibt-parser';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── IBT parsing ─────────────────────────────────────────────────────────
  openIbtFiles: (): Promise<ParsedSession[] | null> =>
    ipcRenderer.invoke('open-ibt-files'),

  parseIbtBuffers: (files: Array<{ name: string; data: ArrayBuffer }>): Promise<ParsedSession[] | null> =>
    ipcRenderer.invoke('parse-ibt-buffers', files),

  platform: process.platform,

  // ── Auto-updater ─────────────────────────────────────────────────────────
  updates: {
    onUpdateDownloaded: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.off('update:downloaded', handler);
    },
    installNow: () => ipcRenderer.send('update:install'),
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    get: (): Promise<{ hardwareAcceleration: boolean }> =>
      ipcRenderer.invoke('settings:get'),
    set: (updates: Partial<{ hardwareAcceleration: boolean }>): Promise<void> =>
      ipcRenderer.invoke('settings:set', updates),
    relaunch: () => ipcRenderer.send('settings:relaunch'),
  },

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
  settings: {
    get: () => Promise<{ hardwareAcceleration: boolean }>;
    set: (updates: Partial<{ hardwareAcceleration: boolean }>) => Promise<void>;
    relaunch: () => void;
  };
  windowControls: WindowControls;
  updates: {
    onUpdateDownloaded: (cb: () => void) => () => void;
    installNow: () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
