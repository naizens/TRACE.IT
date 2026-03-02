import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { autoUpdater } from 'electron-updater';
import { parseIbt } from './ibt-parser';

// ── Persistent config ─────────────────────────────────────────────────────────

interface AppConfig {
  hardwareAcceleration: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
  windowMaximized?: boolean;
}

const CONFIG_PATH = join(app.getPath('userData'), 'config.json');

function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch { /* ignore malformed file */ }
  return { hardwareAcceleration: true };
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// Must run before app.whenReady()
const appConfig = loadConfig();
if (!appConfig.hardwareAcceleration) app.disableHardwareAcceleration();

// Module-level reference so IPC handlers can reach the window
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Restore saved bounds if the window centre is still on a connected display
  const saved = loadConfig().windowBounds;
  let restoreBounds: { x: number; y: number; width: number; height: number } | undefined;
  if (saved) {
    const cx = saved.x + saved.width  / 2;
    const cy = saved.y + saved.height / 2;
    const onScreen = screen.getAllDisplays().some(
      (d) => cx >= d.bounds.x && cx <= d.bounds.x + d.bounds.width &&
             cy >= d.bounds.y && cy <= d.bounds.y + d.bounds.height,
    );
    if (onScreen) restoreBounds = saved;
  }

  mainWindow = new BrowserWindow({
    width:     restoreBounds?.width  ?? 1440,
    height:    restoreBounds?.height ?? 900,
    x:         restoreBounds?.x,
    y:         restoreBounds?.y,
    minWidth:  1100,
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

  // Persist window position/size whenever the user moves or resizes it
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    saveConfig({ ...loadConfig(), windowBounds: mainWindow.getBounds() });
  };
  mainWindow.on('moved',   saveBounds);
  mainWindow.on('resized', saveBounds);

  // Restore maximized state
  if (loadConfig().windowMaximized) mainWindow.maximize();

  // Notify renderer whenever maximise state changes + persist
  mainWindow.on('maximize',   () => { mainWindow?.webContents.send('window:maximized', true);  saveConfig({ ...loadConfig(), windowMaximized: true  }); });
  mainWindow.on('unmaximize', () => { mainWindow?.webContents.send('window:maximized', false); saveConfig({ ...loadConfig(), windowMaximized: false }); });
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

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update:downloaded');
    });

    autoUpdater.checkForUpdates();
  }
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
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

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

// ── Settings ──────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => loadConfig());
ipcMain.handle('settings:set', (_, updates: Partial<AppConfig>) => {
  saveConfig({ ...loadConfig(), ...updates });
});
ipcMain.on('settings:relaunch', () => {
  app.relaunch();
  app.exit();
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
