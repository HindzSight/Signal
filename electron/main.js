import { app, BrowserWindow, dialog } from 'electron';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, ShareManager } from '../src/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Locates the bundled cloudflared binary so recipients never need to install it
// themselves. Packaged builds get it from electron-builder's extraResources
// (see package.json "build" config); in dev we use whatever
// scripts/fetch-cloudflared.mjs put under electron/resources, falling back to
// PATH so `npm run electron:dev` still works before that script has been run.
function resolveCloudflaredPath() {
  const binaryName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  if (app.isPackaged) return path.join(process.resourcesPath, binaryName);
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const devPath = path.join(__dirname, 'resources', `${process.platform}-${arch}`, binaryName);
  return fs.existsSync(devPath) ? devPath : 'cloudflared';
}

function createShareManager() {
  const cloudflaredPath = resolveCloudflaredPath();
  return new ShareManager({
    spawnProcess: (_command, args, options) => spawn(cloudflaredPath, args, options),
    exec: (_command, args, options, callback) => execFile(cloudflaredPath, args, options, callback),
  });
}

async function pickDirectory(mainWindow) {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
}

let appServer = null;

async function start() {
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 880,
    minWidth: 720,
    minHeight: 600,
    title: 'Signal',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  const manager = createShareManager();
  appServer = createServer({ manager, pickDirectory: () => pickDirectory(mainWindow) });
  await new Promise((resolve, reject) => {
    appServer.server.once('error', reject);
    appServer.listen(0, '127.0.0.1', resolve);
  });
  const port = appServer.server.address().port;
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(start);

// A single-window utility: quit fully when the window closes rather than
// lingering in the dock, and always stop every share/tunnel before exiting.
app.on('window-all-closed', () => app.quit());

app.on('before-quit', async event => {
  if (!appServer) return;
  event.preventDefault();
  const server = appServer; appServer = null;
  await server.close();
  app.quit();
});
