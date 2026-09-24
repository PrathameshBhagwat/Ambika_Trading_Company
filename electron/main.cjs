/**
 * Ambika Trading — Electron Main Process
 *
 * Windows desktop offline shell hosting React UI and orchestrating FastAPI backend.
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { startBackend, stopBackend } = require('./backend-manager.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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

app.on('before-quit', () => {
  console.log('[Electron] Shutting down backend...');
  stopBackend();
});
