import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  screen as electronScreen,
  session,
  systemPreferences,
  dialog,
} from 'electron';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import Store from 'electron-store';
import { initCapture } from './capture';
import { getDeviceFingerprint } from './fingerprint';

interface WindowStore {
  windowX: number;
  windowY: number;
  cvText?: string;
  cvFilename?: string;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const fingerprint = getDeviceFingerprint();
const store = new Store<WindowStore>();

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } =
    electronScreen.getPrimaryDisplay().workAreaSize;

  const defaultX = screenWidth - 440;
  const defaultY = Math.floor(screenHeight / 2) - 300;

  const savedX = store.get('windowX', defaultX);
  const savedY = store.get('windowY', defaultY);

  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    x: savedX,
    y: savedY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  mainWindow.setContentProtection(true);

  if (process.platform === 'win32') {
    mainWindow.once('show', () => {
      mainWindow?.setContentProtection(true);
    });
  }

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    store.set('windowX', x);
    store.set('windowY', y);
  });

  if (!app.isPackaged) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ZoomGuru',
      click: () => { mainWindow?.show(); },
    },
    {
      label: 'Hide ZoomGuru',
      click: () => { mainWindow?.hide(); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function registerHotkeys(): void {
  const shortcuts: Array<{ key: string; label: string }> = [
    { key: 'CommandOrControl+Shift+A', label: 'listen' },
    { key: 'CommandOrControl+Shift+S', label: 'screenshot' },
    { key: 'CommandOrControl+Shift+H', label: 'hide/show' },
    { key: 'CommandOrControl+Shift+C', label: 'clear' },
  ];

  const ok = globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow?.webContents.send('trigger:listen');
  });
  if (!ok) console.error('❌ Hotkey Ctrl+Shift+A failed to register — conflict with another app');

  const ok2 = globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow?.webContents.send('trigger:screenshot');
  });
  if (!ok2) console.error('❌ Hotkey Ctrl+Shift+S failed to register — conflict with another app');

  const ok3 = globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
  if (!ok3) console.error('❌ Hotkey Ctrl+Shift+H failed to register — conflict with another app');

  const ok4 = globalShortcut.register('CommandOrControl+Shift+C', () => {
    mainWindow?.webContents.send('trigger:clear');
  });
  if (!ok4) console.error('❌ Hotkey Ctrl+Shift+C failed to register — conflict with another app');

  void shortcuts;
  console.log(`✅ Hotkeys: A=${String(ok)} S=${String(ok2)} H=${String(ok3)} C=${String(ok4)}`);
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:hide', () => {
    mainWindow?.hide();
  });

  ipcMain.handle('device:fingerprint', () => {
    return fingerprint;
  });

  ipcMain.handle('permissions:request-mic', async () => {
    if (process.platform === 'darwin') {
      return await systemPreferences.askForMediaAccess('microphone');
    }
    // On Windows/Linux the Chromium session permission handler covers mic access
    return true;
  });

  ipcMain.handle('cv:parse', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select your CV',
      properties: ['openFile'],
      filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md'] }],
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      let text: string;
      if (ext === '.pdf') {
        const buffer = fs.readFileSync(filePath);
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        text = fs.readFileSync(filePath, 'utf-8');
      }

      store.set('cvText', text);
      store.set('cvFilename', filename);
      return { text, filename };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: `Failed to parse file: ${message}` };
    }
  });

  ipcMain.handle('cv:load', () => {
    const text = store.get('cvText', '');
    const filename = store.get('cvFilename', '');
    if (!text) return null;
    return { text, filename };
  });

  ipcMain.handle('cv:clear', () => {
    store.delete('cvText');
    store.delete('cvFilename');
  });
}

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'display-capture'];
      callback(allowed.includes(permission));
    },
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      const allowed = ['media', 'mediaKeySystem', 'display-capture'];
      return allowed.includes(permission);
    },
  );

  createWindow();
  createTray();
  registerHotkeys();
  registerIpcHandlers();
  initCapture(mainWindow!);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
