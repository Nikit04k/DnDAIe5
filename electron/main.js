const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Portable mode: persist user data (saves, characters, settings) in a 'data' folder alongside the portable exe
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  try {
    const portableDataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
    if (!fs.existsSync(portableDataDir)) {
      fs.mkdirSync(portableDataDir, { recursive: true });
    }
    app.setPath('userData', portableDataDir);
    console.log('[Electron] Portable mode active. User data directory:', portableDataDir);
  } catch (e) {
    console.warn('[Electron] Could not configure portable userData directory:', e);
  }
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../assets/icon.png'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (e) {}
  }
  return undefined;
}

let mainWindow = null;

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

function isServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function waitForServer(url, maxRetries = 60) {
  for (let i = 0; i < maxRetries; i++) {
    const ready = await isServerReady(url);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let internalServerModule = null;

function startInternalServer() {
  try {
    const appDir = app.getAppPath();
    process.env.APP_DIR = appDir;
    process.env.NODE_ENV = app.isPackaged ? 'production' : (process.env.NODE_ENV || 'production');
    
    try {
      process.chdir(appDir);
    } catch (e) {}

    const serverPath = path.join(appDir, 'server.js');
    console.log('[Electron] Loading internal server from:', serverPath);
    internalServerModule = require(serverPath);
  } catch (err) {
    console.error('[Electron] Failed to start internal server:', err);
    dialog.showErrorBox(
      'DnDAIe5 Server Error',
      `Не удалось запустить внутренний сервер игры: ${err.message}`
    );
  }
}

let isTerminating = false;
function terminateApp() {
  if (isTerminating) return;
  isTerminating = true;
  console.log('[Electron] Закрытие приложения и выключение сервера...');

  try {
    if (internalServerModule && typeof internalServerModule.shutdown === 'function') {
      internalServerModule.shutdown(0);
    }
  } catch (e) {}

  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    });
  } catch (e) {}

  try {
    app.quit();
  } catch (e) {}

  // Force immediate process exit on Windows to release port 3000 and avoid zombie processes in Task Manager
  setTimeout(() => {
    try {
      app.exit(0);
    } catch (e) {}
    process.exit(0);
  }, 200).unref();
}

async function createWindow() {
  const icon = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    title: 'DnDAIe5 • AI Dungeon Master & Party RPG',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>DnDAIe5 Loading</title>
      <style>
        body {
          margin: 0;
          background: #020617;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(245, 158, 11, 0.15);
          border-top-color: #f59e0b;
          border-radius: 50%;
          animation: spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          margin-bottom: 22px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { font-size: 20px; font-weight: 700; color: #fbbf24; margin: 0 0 8px 0; }
        p { font-size: 13px; color: #94a3b8; margin: 0; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h2>DnDAIe5 — Запуск игры...</h2>
      <p>Инициализация игрового движка D&D 5e и AI Dungeon Master</p>
    </body>
    </html>
  `;

  // Show window immediately with splash screen
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  mainWindow.show();

  // Check if server is already running, if not start it
  const alreadyRunning = await isServerReady(SERVER_URL);
  if (!alreadyRunning) {
    startInternalServer();
  }

  // Wait for server to respond
  const serverReady = await waitForServer(SERVER_URL, 60);

  if (serverReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(SERVER_URL);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox(
      'DnDAIe5 Timeout',
      'Сервер игры не ответил за 30 секунд. Попробуйте перезапустить приложение.'
    );
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', () => {
    terminateApp();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    terminateApp();
  });
}

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  terminateApp();
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('open-external', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  terminateApp();
});

app.on('before-quit', () => {
  terminateApp();
});

app.on('will-quit', () => {
  terminateApp();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('SIGINT', () => terminateApp());
process.on('SIGTERM', () => terminateApp());
process.on('SIGBREAK', () => terminateApp());
process.on('SIGHUP', () => terminateApp());
