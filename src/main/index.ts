import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { readFileSync } from 'fs';
import { parseIbt } from './ibt-parser';

// Module-level reference so IPC handlers can reach the window
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 640,
    // Remove native frame — we render our own titlebar
    frame: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Notify renderer whenever maximise state changes
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximized',   true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized',   false));
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('window:maximized', false));

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// Sync query: renderer asks current maximised state on mount
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

// ── File parsing ──────────────────────────────────────────────────────────────
ipcMain.handle('open-ibt-files', async () => {
  if (!mainWindow) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open iRacing Telemetry',
    filters: [{ name: 'iRacing Telemetry', extensions: ['ibt'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (canceled || filePaths.length === 0) return null;

  const results = [];
  for (const filePath of filePaths) {
    try {
      const buffer = readFileSync(filePath);
      const parsed = parseIbt(Buffer.from(buffer), filePath.split(/[\\/]/).pop()!);
      results.push(parsed);
    } catch (err) {
      console.error(`[main] Failed to parse ${filePath}:`, (err as Error).message);
    }
  }

  return results.length > 0 ? results : null;
});

// ── Drag-and-drop parsing (raw buffers from renderer drag events) ─────────────
ipcMain.handle('parse-ibt-buffers', async (_, files: Array<{ name: string; data: ArrayBuffer }>) => {
  const results = [];
  for (const file of files) {
    try {
      const parsed = parseIbt(Buffer.from(file.data), file.name);
      results.push(parsed);
    } catch (err) {
      console.error(`[main] Failed to parse ${file.name}:`, (err as Error).message);
    }
  }
  return results.length > 0 ? results : null;
});
