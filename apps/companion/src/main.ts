import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  type DesktopCapturerSource,
  type IpcMainInvokeEvent,
} from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAllowedNavigation,
  isPredecessorWindowName,
  resolvePortalUrl,
  sanitizeAdvice,
} from './security-policy.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const portalUrl = resolvePortalUrl(process.argv, process.env);
let controllerWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let selectedSourceId: string | null = null;
let adviceTimer: NodeJS.Timeout | null = null;

app.enableSandbox();

async function gameSources(): Promise<DesktopCapturerSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    fetchWindowIcons: false,
    thumbnailSize: { width: 0, height: 0 },
  });
  return sources.filter((source) => isPredecessorWindowName(source.name));
}

function trustedControllerSender(event: IpcMainInvokeEvent): boolean {
  if (!controllerWindow || event.sender !== controllerWindow.webContents) return false;
  const senderFrame = event.senderFrame;
  return !!senderFrame && isAllowedNavigation(senderFrame.url, portalUrl);
}

function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    ...display.bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(currentDirectory, 'overlay-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setIgnoreMouseEvents(true, { forward: true });
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  void window.loadFile(join(currentDirectory, 'overlay', 'overlay.html'));
  return window;
}

function createControllerWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 880,
    minHeight: 640,
    title: 'RiftLine Companion',
    backgroundColor: '#090d15',
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      partition: 'persist:riftline-companion',
    },
  });
  const companionSession = window.webContents.session;
  companionSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const trusted = webContents === window.webContents && isAllowedNavigation(webContents.getURL(), portalUrl);
    callback(trusted && (permission === 'media' || permission === 'display-capture'));
  });
  companionSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await gameSources();
    const source = sources.find((candidate) => candidate.id === selectedSourceId) ?? sources[0];
    if (!source) {
      callback({});
      return;
    }
    selectedSourceId = source.id;
    callback({ video: source });
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (!isAllowedNavigation(target, portalUrl)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void window.loadURL(portalUrl.href);
  return window;
}

function clearAdvice(): void {
  if (adviceTimer) clearTimeout(adviceTimer);
  adviceTimer = null;
  overlayWindow?.webContents.send('overlay:clear');
  overlayWindow?.hide();
}

function registerIpc(): void {
  ipcMain.handle('companion:environment', (event) => {
    if (!trustedControllerSender(event)) return null;
    return {
      version: app.getVersion(),
      portalOrigin: portalUrl.origin,
      platform: process.platform,
      capturePolicy: 'predecessor-window-only',
      panicShortcut: 'Ctrl+Shift+F10',
    };
  });
  ipcMain.handle('companion:scan-game-windows', async (event) => {
    if (!trustedControllerSender(event)) return [];
    const sources = await gameSources();
    return sources.map((source) => ({ id: source.id, name: source.name.slice(0, 160), selected: source.id === selectedSourceId }));
  });
  ipcMain.handle('companion:select-game-window', async (event, requestedId: unknown) => {
    if (!trustedControllerSender(event) || typeof requestedId !== 'string') return { selected: false };
    const source = (await gameSources()).find((candidate) => candidate.id === requestedId);
    if (!source) return { selected: false };
    selectedSourceId = source.id;
    return { selected: true, source: { id: source.id, name: source.name.slice(0, 160) } };
  });
  ipcMain.handle('companion:show-advice', (event, input: unknown) => {
    if (!trustedControllerSender(event)) return { shown: false };
    const advice = sanitizeAdvice(input);
    if (!advice || !overlayWindow) return { shown: false };
    if (adviceTimer) clearTimeout(adviceTimer);
    overlayWindow.webContents.send('overlay:advice', advice);
    overlayWindow.showInactive();
    adviceTimer = setTimeout(clearAdvice, advice.durationMs);
    return { shown: true };
  });
  ipcMain.handle('companion:clear-advice', (event) => {
    if (!trustedControllerSender(event)) return { cleared: false };
    clearAdvice();
    return { cleared: true };
  });
}

app.whenReady().then(() => {
  registerIpc();
  overlayWindow = createOverlayWindow();
  controllerWindow = createControllerWindow();
  globalShortcut.register('CommandOrControl+Shift+F10', () => {
    clearAdvice();
    controllerWindow?.webContents.send('companion:panic-stop');
    controllerWindow?.show();
  });
  app.on('activate', () => {
    if (!controllerWindow) controllerWindow = createControllerWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
