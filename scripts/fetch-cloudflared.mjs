// Downloads the platform cloudflared binaries used to bundle the Electron app so
// recipients never need to install cloudflared themselves. Pulls the latest
// release from Cloudflare's GitHub repo via its stable "latest" permalink.
//
// Usage: node scripts/fetch-cloudflared.mjs [win32-x64] [darwin-x64] [darwin-arm64] [linux-x64]
// With no arguments, fetches all of them.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '..', 'electron', 'resources');
const LATEST_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

const TARGETS = {
  'win32-x64': { asset: 'cloudflared-windows-amd64.exe', kind: 'exe', binaryName: 'cloudflared.exe' },
  'darwin-x64': { asset: 'cloudflared-darwin-amd64.tgz', kind: 'tgz', binaryName: 'cloudflared' },
  'darwin-arm64': { asset: 'cloudflared-darwin-arm64.tgz', kind: 'tgz', binaryName: 'cloudflared' },
  'linux-x64': { asset: 'cloudflared-linux-amd64', kind: 'bin', binaryName: 'cloudflared' },
};

async function download(url, destFile) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  await fsp.writeFile(destFile, Buffer.from(await response.arrayBuffer()));
}

async function fetchTarget(name) {
  const target = TARGETS[name];
  if (!target) throw new Error(`Unknown target "${name}". Expected one of: ${Object.keys(TARGETS).join(', ')}`);
  const dir = path.join(RESOURCES_DIR, name);
  await fsp.mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, target.binaryName);
  console.log(`Fetching ${target.asset} -> ${finalPath}`);

  if (target.kind === 'exe') {
    await download(`${LATEST_BASE}/${target.asset}`, finalPath);
  } else if (target.kind === 'bin') {
    await download(`${LATEST_BASE}/${target.asset}`, finalPath);
    await fsp.chmod(finalPath, 0o755);
  } else {
    const tgzPath = path.join(dir, target.asset);
    await download(`${LATEST_BASE}/${target.asset}`, tgzPath);
    // Run with cwd set and a bare filename, not an absolute path: GNU tar on
    // Windows misreads a "C:\..." argument as a remote-host spec (the colon).
    await execFileAsync('tar', ['-xzf', target.asset], { cwd: dir });
    await fsp.rm(tgzPath);
    await fsp.chmod(finalPath, 0o755);
  }
  console.log(`  done (${(await fsp.stat(finalPath)).size} bytes)`);
}

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(TARGETS);
for (const name of names) await fetchTarget(name);
