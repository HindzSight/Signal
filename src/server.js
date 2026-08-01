import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { createHash, randomBytes, scryptSync, timingSafeEqual, createHmac, createCipheriv, createDecipheriv } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { ZipFile } from 'yazl';
import { pickDirectory } from './folder-picker.js';
import { DASHBOARD_RUNTIME_JS, MODERN_DASHBOARD, MODERN_STYLE, PUBLIC_RECIPIENT_JS, RECIPIENT_UI_STYLE, SHADCN_THEME_STYLE, TRANSFER_UI_STYLE, UI_OVERRIDES } from './ui.js';

const HOURS = 60 * 60 * 1000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// The built React dashboard (frontend/dist). When present it replaces the
// legacy inline dashboard for the local sender; otherwise we fall back to it.
const DIST_DIR = fileURLToPath(new URL('../frontend/dist', import.meta.url));
const hasBuiltFrontend = fs.existsSync(path.join(DIST_DIR, 'index.html'));
const STATIC_MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json' };
function serveStatic(res, filePath) {
  const type = STATIC_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.zip': 'application/zip', '.txt': 'text/plain' };

function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
function html(res, status, value) { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(value); }
function text(res, status, value) { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); res.end(value); }
function css(res, value) { res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' }); res.end(value); }
function body(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', c => { data += c; if (data.length > 100_000) req.destroy(); }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function cookie(req, name) { const found = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`)); return found?.slice(name.length + 1); }
function localRequest(req) { const host = (req.headers.host || '').split(':')[0].toLowerCase(); return LOCAL_HOSTS.has(host); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

export function hashPasscode(passcode, salt = randomBytes(16).toString('base64url')) { return `${salt}:${scryptSync(passcode, salt, 32).toString('base64url')}`; }
export function verifyPasscode(passcode, stored) { const [salt, hash] = stored.split(':'); const actual = scryptSync(passcode, salt, 32).toString('base64url'); return timingSafeEqual(Buffer.from(actual), Buffer.from(hash)); }
export function readablePasscode() { return randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 12).replace(/(.{4})/g, '$1-').replace(/-$/, ''); }
function encryptPasscode(passcode, key) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(passcode, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`; }
function decryptPasscode(stored, key) { const [iv, tag, encrypted] = stored.split('.').map(value => Buffer.from(value, 'base64url')); const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'); }

export function containedPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function resolveSharedFile(share, relative) {
  const requested = path.resolve(share.root, relative);
  if (!containedPath(share.root, requested)) throw new Error('Outside shared folder');
  const real = await fsp.realpath(requested);
  if (!containedPath(share.rootReal, real)) throw new Error('Symlink leaves shared folder');
  return real;
}

export class ShareManager {
  constructor({ spawnProcess = spawn, exec = execFile, now = () => Date.now(), tunnelTarget = 'http://127.0.0.1:8787' } = {}) { this.shares = new Map(); this.listeners = new Set(); this.spawnProcess = spawnProcess; this.exec = exec; this.now = now; this.secret = randomBytes(32); this.tunnelTarget = tunnelTarget; }
  emit() { const snapshot = this.list(); for (const listener of this.listeners) listener(snapshot); }
  list() { return [...this.shares.values()].map(s => ({ id: s.id, name: s.name, url: s.url, expiresAt: s.expiresAt, status: s.status, transfers: [...s.transfers.values()] })); }
  async cloudflaredAvailable() { return new Promise(resolve => this.exec('cloudflared', ['--version'], { windowsHide: true }, error => resolve(!error))); }
  signedSession(id) { const expiresAt = this.now() + 12 * HOURS; const payload = `${id}.${expiresAt}.${randomBytes(12).toString('base64url')}`; return `${payload}.${createHmac('sha256', this.secret).update(payload).digest('base64url')}`; }
  validSession(token, id) { if (!token) return false; const parts = token.split('.'); if (parts.length !== 4 || parts[0] !== id || Number(parts[1]) < this.now()) return false; const payload = parts.slice(0, 3).join('.'); const expected = createHmac('sha256', this.secret).update(payload).digest('base64url'); return timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected)); }
  get(id) { const share = this.shares.get(id); if (!share || share.expiresAt <= this.now() || share.status !== 'active') { if (share) this.stop(id); return null; } return share; }
  async create({ folderPath, expiresInHours = 24 }) {
    if (!Number.isFinite(Number(expiresInHours)) || expiresInHours < 1 || expiresInHours > 168) throw new Error('Expiry must be between 1 and 168 hours');
    const root = path.resolve(folderPath); const stat = await fsp.stat(root); if (!stat.isDirectory()) throw new Error('Select a folder');
    const id = randomBytes(18).toString('base64url'); const passcode = readablePasscode();
    const share = { id, root, rootReal: await fsp.realpath(root), name: path.basename(root), passcodeHash: hashPasscode(passcode), passcodeCipher: encryptPasscode(passcode, this.secret), expiresAt: this.now() + Number(expiresInHours) * HOURS, status: 'starting', url: null, tunnel: null, transfers: new Map(), stopping: false };
    this.shares.set(id, share); this.emit();
    try { await this.startTunnel(share); share.status = 'active'; this.scheduleExpiry(share); this.emit(); return { share: this.publicShare(share), passcode }; }
    catch (error) { share.stopping = true; share.tunnel?.kill(); this.shares.delete(id); this.emit(); throw error; }
  }
  publicShare(s) { return { id: s.id, name: s.name, url: s.url, expiresAt: s.expiresAt, status: s.status, transfers: [...s.transfers.values()] }; }
  credentials(id) { const share = this.get(id); if (!share) return null; if (!share.passcodeCipher) throw new Error('This share was created before passcode recovery was available. Create a new share to copy its passcode again.'); return { url: share.url, passcode: decryptPasscode(share.passcodeCipher, this.secret) }; }
  scheduleExpiry(share) { share.timer = setTimeout(() => this.stop(share.id), Math.max(0, share.expiresAt - this.now())); }
  startTunnel(share) { return new Promise((resolve, reject) => {
    let settled = false; let outputBuffer = ''; const logs = []; const finish = (error, url) => { if (settled) return; settled = true; error ? reject(error) : resolve(url); };
    const tunnel = this.spawnProcess('cloudflared', ['tunnel', '--url', this.tunnelTarget], { windowsHide: true }); share.tunnel = tunnel;
    const output = chunk => { const line = String(chunk); logs.push(line); if (logs.length > 12) logs.shift(); outputBuffer = `${outputBuffer}${line}`.slice(-8_000); const match = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i); if (match) { share.url = `${match[0]}/s/${share.id}`; finish(null, share.url); } };
    tunnel.stdout?.on('data', output); tunnel.stderr?.on('data', output);
    tunnel.once('error', error => finish(error));
    tunnel.once('exit', code => { if (!settled) { const detail = logs.join('').replace(/\s+/g, ' ').trim(); finish(new Error(detail || `cloudflared exited before creating a tunnel (${code ?? 'unknown'})`)); } if (!share.stopping) this.stop(share.id); });
    setTimeout(() => finish(new Error('Timed out waiting for Cloudflare Quick Tunnel. Check your internet connection or firewall.')), 12_000).unref();
  }); }
  stop(id) { const share = this.shares.get(id); if (!share) return false; share.stopping = true; clearTimeout(share.timer); this.shares.delete(id); share.tunnel?.kill(); this.emit(); return true; }
  stopAll() { for (const id of [...this.shares.keys()]) this.stop(id); }
  addTransfer(share, transfer) { share.transfers.set(transfer.id, transfer); this.emit(); }
  updateTransfer(share, transfer) { share.transfers.set(transfer.id, transfer); this.emit(); }
}

async function folderTree(share, directory = share.root, prefix = '') {
  const entries = await fsp.readdir(directory, { withFileTypes: true }); const items = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name); const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) items.push({ name: entry.name, path: relative, type: 'directory', children: await folderTree(share, absolute, relative) });
    else if (entry.isFile()) { const info = await fsp.stat(absolute); items.push({ name: entry.name, path: relative, type: 'file', size: info.size }); }
  }
  return items;
}

// Flat leaf-file listing used to build a "whole folder" zip. Mirrors folderTree's
// symlink-skipping walk but returns {relative, absolute, size} instead of a tree.
async function collectFiles(directory, prefix = '') {
  const entries = await fsp.readdir(directory, { withFileTypes: true }); let files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name); const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files = files.concat(await collectFiles(absolute, relative));
    else if (entry.isFile()) { const info = await fsp.stat(absolute); files.push({ relative, absolute, size: info.size }); }
  }
  return files;
}

// Expands a requested path into the concrete files to zip. A directory entry is
// walked (symlink-safe, mirroring collectFiles) so a recipient can grab a whole
// subfolder by path; a file resolves to itself; anything else is skipped. All
// checks go through resolveSharedFile so nothing can escape the shared folder.
async function expandPath(share, relative) {
  const absolute = await resolveSharedFile(share, relative);
  const stat = await fsp.stat(absolute);
  if (stat.isFile()) return [{ relative, absolute, size: stat.size }];
  if (stat.isDirectory()) {
    const files = [];
    await collectInto(absolute, relative, files);
    return files;
  }
  return [];
}

async function collectInto(directory, prefix, out) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name); const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collectInto(absolute, relative, out);
    else if (entry.isFile()) { const info = await fsp.stat(absolute); out.push({ relative, absolute, size: info.size }); }
  }
}

function recipientPage(share, authenticated, error = '') {
  const data = authenticated
    ? `<script>window.SHARE=${JSON.stringify({ id: share.id, name: share.name })}</script><script type="module" src="/public-recipient.js"></script>`
    : `<section class="recipient-card"><div class="recipient-icon">FS</div><p class="eyebrow">SIGNAL &middot; SECURE TRANSFER</p><h1>${escapeHtml(share.name)}</h1><p class="recipient-copy">This folder is protected. Enter the passcode the sender shared with you to view and download files.</p><form method="post" action="/s/${share.id}/auth"><label class="field"><span>Passcode</span><input name="passcode" type="password" autocomplete="current-password" placeholder="XXXX-XXXX-XXXX" required autofocus></label>${error ? `<p class="recipient-error">${escapeHtml(error)}</p>` : ''}<button class="button primary recipient-submit">Open secure folder</button></form><p class="recipient-note">The sender can stop this share at any time.</p></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(share.name)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/style.css"></head><body class="recipient-body"><main class="recipient">${data}</main></body></html>`;
}

export function createServer(options = {}) {
  const manager = options.manager || new ShareManager(options);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local'); const isLocal = localRequest(req);
    try {
      if (url.pathname === '/style.css') return css(res, MODERN_STYLE + UI_OVERRIDES + SHADCN_THEME_STYLE + TRANSFER_UI_STYLE + RECIPIENT_UI_STYLE);
      if (url.pathname === '/public-recipient.js') return javascript(res, PUBLIC_RECIPIENT_JS);
      // Local sender dashboard: prefer the built React app, else the legacy inline UI.
      if (isLocal && hasBuiltFrontend) {
        if (url.pathname === '/') return serveStatic(res, path.join(DIST_DIR, 'index.html'));
        if (url.pathname.startsWith('/assets/')) {
          const filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname.slice(1)));
          if (containedPath(DIST_DIR, filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return serveStatic(res, filePath);
          return text(res, 404, 'Not found');
        }
      }
      if (url.pathname === '/dashboard.js' && isLocal) return javascript(res, DASHBOARD_RUNTIME_JS);
      if (url.pathname === '/' && isLocal) return html(res, 200, MODERN_DASHBOARD);
      if (url.pathname === '/api/health' && isLocal) return json(res, 200, { cloudflared: await manager.cloudflaredAvailable() });
      if (url.pathname === '/api/select-folder' && isLocal && req.method === 'POST') return json(res, 200, { folderPath: await (options.pickDirectory || pickDirectory)() });
      if (url.pathname === '/api/shares' && isLocal && req.method === 'GET') return json(res, 200, manager.list());
      const credentialMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/credentials$/);
      if (credentialMatch && isLocal && req.method === 'GET') { const credentials = manager.credentials(credentialMatch[1]); return credentials ? json(res, 200, credentials) : json(res, 404, { error: 'Share not found' }); }
      if (url.pathname === '/api/shares' && isLocal && req.method === 'POST') { const result = await manager.create(await body(req)); return json(res, 201, result); }
      if (url.pathname.startsWith('/api/shares/') && isLocal && req.method === 'DELETE') { const stopped = manager.stop(url.pathname.split('/').pop()); return json(res, stopped ? 200 : 404, { stopped }); }
      if (url.pathname === '/api/events' && isLocal) { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); const listener = data => res.write(`data: ${JSON.stringify(data)}\n\n`); manager.listeners.add(listener); listener(manager.list()); req.on('close', () => manager.listeners.delete(listener)); return; }
      const match = url.pathname.match(/^\/s\/([^/]+)(?:\/(.*))?$/); if (!match) return text(res, 404, 'Not found');
      const share = manager.get(match[1]); if (!share) return text(res, 404, 'This share is no longer available.');
      const rest = match[2] || ''; const authed = manager.validSession(cookie(req, `share_${share.id}`), share.id);
      if (rest === '' && req.method === 'GET') return html(res, 200, recipientPage(share, authed));
      if (rest === 'auth' && req.method === 'POST') { const raw = await new Promise(resolve => { let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(new URLSearchParams(d))); }); if (!verifyPasscode(raw.get('passcode') || '', share.passcodeHash)) return html(res, 401, recipientPage(share, false, 'Incorrect passcode. Please try again.')); const token = manager.signedSession(share.id); res.writeHead(303, { location: `/s/${share.id}`, 'set-cookie': `share_${share.id}=${token}; Path=/s/${share.id}; HttpOnly; SameSite=Lax; Max-Age=${12 * 60 * 60}` }); return res.end(); }
      if (!authed) return text(res, 401, 'Passcode required');
      if (rest === 'tree' && req.method === 'GET') return json(res, 200, await folderTree(share));
      if (rest.startsWith('file/') && (req.method === 'GET' || req.method === 'HEAD')) return await streamFile(req, res, share, decodeURIComponent(rest.slice(5)), manager);
      if (rest === 'zip' && req.method === 'GET') return await streamZip(res, share, url.searchParams.get('paths'), manager);
      return text(res, 404, 'Not found');
    } catch (error) { if (error.code === 'ENOENT') return text(res, 404, 'File not found'); console.error(error); return json(res, 400, { error: error.message || 'Request failed' }); }
  });
  const listen = (...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : undefined;
    return server.listen(...args, () => {
      const address = server.address();
      if (address && typeof address === 'object') manager.tunnelTarget = `http://127.0.0.1:${address.port}`;
      callback?.();
    });
  };
  return { manager, server, listen, close: async () => { manager.stopAll(); await new Promise(resolve => server.close(resolve)); } };
}

function javascript(res, source) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(source); }
async function streamFile(req, res, share, relative, manager) {
  const file = await resolveSharedFile(share, relative); const stat = await fsp.stat(file); if (!stat.isFile()) return text(res, 404, 'Not a file');
  let start = 0, end = stat.size - 1, status = 200; const range = req.headers.range;
  if (range) { const m = range.match(/^bytes=(\d*)-(\d*)$/); if (!m) { res.writeHead(416, { 'content-range': `bytes */${stat.size}` }); return res.end(); } start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2])); end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1; if (start > end || start >= stat.size) { res.writeHead(416, { 'content-range': `bytes */${stat.size}` }); return res.end(); } status = 206; }
  const length = end - start + 1; const name = path.basename(file); const headers = { 'content-type': MIME[path.extname(name).toLowerCase()] || 'application/octet-stream', 'content-length': length, 'accept-ranges': 'bytes', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` }; if (status === 206) headers['content-range'] = `bytes ${start}-${end}/${stat.size}`; res.writeHead(status, headers); if (req.method === 'HEAD') return res.end();
  const transfer = { id: randomBytes(9).toString('base64url'), file: relative, size: stat.size, bytesSent: 0, percent: 0, speed: 0, status: 'active', startedAt: Date.now() }; manager.addTransfer(share, transfer);
  const source = fs.createReadStream(file, { start, end }); let settled = false;
  const finish = state => { if (settled) return; settled = true; transfer.status = state; transfer.percent = Math.min(100, Math.round((transfer.bytesSent / length) * 100)); manager.updateTransfer(share, transfer); };
  source.on('data', chunk => { if (settled) return; transfer.bytesSent += chunk.length; transfer.percent = Math.min(100, Math.round((transfer.bytesSent / length) * 100)); transfer.speed = Math.round(transfer.bytesSent / Math.max(1, (Date.now() - transfer.startedAt) / 1000)); manager.updateTransfer(share, transfer); });
  source.on('end', () => finish('completed')); source.on('error', () => finish('cancelled')); res.on('close', () => { if (!settled && transfer.bytesSent < length) source.destroy(); finish(transfer.bytesSent >= length ? 'completed' : 'cancelled'); }); source.pipe(res);
}

// Bundles the requested files (or the whole share, if pathsParam is empty) into a
// single streamed ZIP. A single archive is one HTTP request and one browser
// download, which sidesteps the "multiple automatic downloads" block that
// silently drops all but the first file when several are downloaded individually
// in a row without their own user gesture.
async function streamZip(res, share, pathsParam, manager) {
  let entries;
  if (pathsParam) {
    let requested;
    try { requested = JSON.parse(pathsParam); } catch { return json(res, 400, { error: 'Invalid paths parameter' }); }
    if (!Array.isArray(requested) || requested.some(p => typeof p !== 'string') || requested.length === 0) return json(res, 400, { error: 'Invalid paths parameter' });
    entries = [];
    for (const relative of requested) {
      for (const entry of await expandPath(share, relative)) entries.push(entry);
    }
    // De-dupe in case the selection overlaps (e.g. a folder plus files inside it).
    const seen = new Set();
    entries = entries.filter(entry => seen.has(entry.absolute) ? false : (seen.add(entry.absolute), true));
  } else {
    entries = await collectFiles(share.root);
  }
  if (!entries.length) return text(res, 404, 'No files to download');

  const zipName = `${share.name}.zip`;
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  const transfer = { id: randomBytes(9).toString('base64url'), file: zipName, size: totalSize, bytesSent: 0, percent: 0, speed: 0, status: 'active', startedAt: Date.now() };
  manager.addTransfer(share, transfer);
  let settled = false;
  const finish = state => { if (settled) return; settled = true; transfer.status = state; if (state === 'completed') transfer.percent = 100; manager.updateTransfer(share, transfer); };

  const zipfile = new ZipFile();
  for (const entry of entries) zipfile.addFile(entry.absolute, entry.relative, { compress: false });

  zipfile.end({}, calculatedTotalSize => {
    const headers = { 'content-type': 'application/zip', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`, 'cache-control': 'no-store' };
    if (calculatedTotalSize >= 0) { headers['content-length'] = calculatedTotalSize; transfer.size = calculatedTotalSize; }
    res.writeHead(200, headers);
    zipfile.outputStream.on('data', chunk => {
      if (settled) return;
      transfer.bytesSent += chunk.length;
      transfer.percent = transfer.size > 0 ? Math.min(99, Math.round((transfer.bytesSent / transfer.size) * 100)) : 0;
      transfer.speed = Math.round(transfer.bytesSent / Math.max(1, (Date.now() - transfer.startedAt) / 1000));
      manager.updateTransfer(share, transfer);
    });
    zipfile.outputStream.on('end', () => finish('completed'));
    zipfile.outputStream.on('error', () => finish('cancelled'));
    res.on('close', () => finish(transfer.bytesSent >= transfer.size ? 'completed' : 'cancelled'));
    zipfile.outputStream.pipe(res);
  });
}
