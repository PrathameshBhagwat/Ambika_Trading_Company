/**
 * Ambika Trading — Electron Main Process
 *
 * Windows desktop offline shell hosting React UI and orchestrating FastAPI backend.
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startBackend, stopBackend } = require('./backend-manager.cjs');

const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
const distExists = fs.existsSync(distPath);
const isDev = process.env.NODE_ENV === 'development' || (!distExists && !app.isPackaged);
let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    show: false,
    title: 'Ambika Trading - Farmer Settlement System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Remove default menu for sleek native desktop feel
  mainWindow.setMenuBarVisibility(false);

  // Ready to show event
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    const devUrl = 'http://localhost:5173';
    console.log(`[Electron] Loading Vite Dev Server: ${devUrl}`);
    mainWindow.loadURL(devUrl).catch(() => {
      console.log('[Electron] Vite not ready yet, retrying...');
      setTimeout(() => mainWindow.loadURL(devUrl), 1500);
    });
  } else {
    const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ───
ipcMain.handle('print-bill', async () => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  try {
    mainWindow.webContents.print(
      {
        silent: false,
        printBackground: true,
      },
      (success, failureReason) => {
        if (!success) {
          console.warn('[Electron Print] Failed or cancelled:', failureReason);
        }
      }
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Backup Destination Folder',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('select-file', async (_event, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select Backup Database to Restore',
    filters: filters || [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

// ─── Auto-Backup on Exit (Phase J) ───
function runAutoBackup() {
  const homeDir = process.env.USERPROFILE || process.env.APPDATA || require('os').homedir();
  const appDataDir = path.join(homeDir, 'AmbikaTrading');
  const backupDir = path.join(appDataDir, 'Backups');
  const dbFile = path.join(appDataDir, 'ambika_trading.db');

  if (!fs.existsSync(dbFile)) {
    console.log('[Auto-Backup] Database file does not exist yet, skipping backup.');
    return;
  }

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupFileName = `ambika_backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    // Copy database file
    fs.copyFileSync(dbFile, backupPath);

    // Verify backup file exists and has size
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      console.error('[Auto-Backup] Backup file size is 0 bytes!');
      try { fs.unlinkSync(backupPath); } catch {}
      return;
    }

    console.log(`[Auto-Backup] Successfully created auto-backup: ${backupPath}`);

    // Prune older backups: keep latest 30 only after successful new backup
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('ambika_backup_') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        fullPath: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    if (files.length > 30) {
      const toDelete = files.slice(30);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.fullPath);
          console.log(`[Auto-Backup] Pruned old auto-backup: ${item.name}`);
        } catch (delErr) {
          console.warn(`[Auto-Backup] Could not delete old backup ${item.name}:`, delErr);
        }
      }
    }
  } catch (err) {
    console.error('[Auto-Backup] Error during automated backup on shutdown:', err);
    // Allow safe application shutdown
  }
}

// ─── Lifecycle ───
app.whenReady().then(async () => {
  console.log('[Electron] Application starting...');
  await startBackend(isDev);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isQuitting = false;

app.on('before-quit', () => {
  if (isQuitting) return;
  isQuitting = true;
  console.log('[Electron] Running automated exit backup...');
  try {
    runAutoBackup();
  } catch (backupErr) {
    console.error('[Electron] Auto-backup failed on shutdown:', backupErr);
  }
  console.log('[Electron] Shutting down backend...');
  stopBackend();
});
