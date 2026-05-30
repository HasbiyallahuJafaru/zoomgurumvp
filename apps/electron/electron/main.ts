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
  desktopCapturer,
  shell,
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
  jdText?: string;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const fingerprint = getDeviceFingerprint();
const store = new Store<WindowStore>();

// Prevent multiple instances from competing for global hotkeys.
// Secondary instances show the existing window and quit.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

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
        devTools: !app.isPackaged,
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

  function tryRegister(
    primary: string,
    fallback: string,
    handler: () => void,
    label: string,
  ): void {
    if (globalShortcut.register(primary, handler)) {
      console.log(`✅ ${label}: ${primary}`);
      return;
    }
    console.warn(`⚠  ${primary} taken by another app — trying fallback ${fallback}`);
    if (globalShortcut.register(fallback, handler)) {
      console.log(`✅ ${label}: ${fallback} (fallback)`);
    } else {
      console.error(`❌ ${label}: both ${primary} and ${fallback} blocked — close the conflicting app`);
    }
  }

  function registerHotkeys(): void {
    tryRegister(
      'CommandOrControl+Shift+A', 'CommandOrControl+Alt+A',
      () => mainWindow?.webContents.send('trigger:listen'),
      'Listen',
    );
    tryRegister(
      'CommandOrControl+Shift+S', 'CommandOrControl+Alt+S',
      () => mainWindow?.webContents.send('trigger:screenshot'),
      'Screenshot',
    );
    tryRegister(
      'CommandOrControl+Shift+H', 'CommandOrControl+Alt+H',
      () => {
        if (mainWindow?.isVisible()) mainWindow.hide();
        else mainWindow?.show();
      },
      'Hide/show',
    );
    tryRegister(
      'CommandOrControl+Shift+C', 'CommandOrControl+Alt+C',
      () => mainWindow?.webContents.send('trigger:clear'),
      'Clear',
    );
    tryRegister(
      'CommandOrControl+Shift+D', 'CommandOrControl+Alt+D',
      () => mainWindow?.webContents.send('trigger:auto'),
      'Auto',
    );
  }

  function registerIpcHandlers(): void {
    ipcMain.handle('window:hide', () => {
      mainWindow?.hide();
    });

    ipcMain.handle('window:quit', () => {
      isQuitting = true;
      app.quit();
    });

    ipcMain.handle('device:fingerprint', () => {
      return fingerprint;
    });

    ipcMain.handle('permissions:request-mic', async () => {
      if (process.platform === 'darwin') {
        return await systemPreferences.askForMediaAccess('microphone');
      }
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

    ipcMain.handle('capture:audio-source-id', async () => {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      return sources[0]?.id ?? '';
    });

    ipcMain.handle('jd:save', (_event, text: string) => {
      if (typeof text !== 'string' || text.length > 100_000) return;
      store.set('jdText', text);
    });

    ipcMain.handle('jd:load', () => {
      const text = store.get('jdText', '');
      return text || null;
    });

    ipcMain.handle('jd:clear', () => {
      store.delete('jdText');
    });

    ipcMain.handle('open-external', (_event, url: string) => {
      void shell.openExternal(url);
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

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' http://localhost:3000 http://localhost:5173 https://api.deepseek.com https://api.groq.com https://*.paystack.co https://*.paystack.com",
              "img-src 'self' data: blob: https://*.paystack.co https://*.paystack.com",
              "media-src 'self' blob:",
              "frame-src https://checkout.paystack.com",
            ].join('; '),
          ],
        },
      });
    });

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
}
