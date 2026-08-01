import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { hashPasscode, verifyPasscode, containedPath, resolveSharedFile, ShareManager, createServer } from '../src/server.js';

function mockTunnelManager() {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => { child.killed = true; };
  return new ShareManager({ spawnProcess: () => { queueMicrotask(() => child.stderr.emit('data', 'Your quick Tunnel has been created! https://verify.trycloudflare.com')); return child; } });
}

async function startTestShare(folder) {
  const manager = mockTunnelManager();
  const app = createServer({ manager });
  const { share } = await manager.create({ folderPath: folder, expiresInHours: 1 });
  await new Promise(resolve => app.listen(0, resolve));
  const port = app.server.address().port;
  const cookie = `share_${share.id}=${manager.signedSession(share.id)}`;
  return { app, manager, share, port, cookie };
}

test('passcodes are salted and validate without storing plaintext', () => {
  const stored = hashPasscode('ABCD-1234');
  assert.equal(verifyPasscode('ABCD-1234', stored), true);
  assert.equal(verifyPasscode('wrong', stored), false);
  assert.equal(stored.includes('ABCD-1234'), false);
});

test('containment rejects traversal paths', () => {
  const root = path.resolve('/shared');
  assert.equal(containedPath(root, path.resolve(root, 'nested/file.jpg')), true);
  assert.equal(containedPath(root, path.resolve(root, '../secret.txt')), false);
});

test('resolved files cannot escape through a symlink', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-outside-'));
  await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
  try { await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt')); }
  catch { t.skip('Symlinks are unavailable for this user'); return; }
  await assert.rejects(resolveSharedFile({ root, rootReal: await fs.realpath(root) }, 'link.txt'));
  await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true });
});

test('a stopped share is immediately unavailable and terminates its tunnel', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-'));
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => { child.killed = true; };
  const manager = new ShareManager({ spawnProcess: () => { queueMicrotask(() => { child.stderr.emit('data', 'Your quick Tunnel has been created! https://orange.'); child.stderr.emit('data', 'trycloudflare.com'); }); return child; } });
  const { share, passcode } = await manager.create({ folderPath: folder, expiresInHours: 1 });
  assert.equal(share.url, `https://orange.trycloudflare.com/s/${share.id}`);
  assert.deepEqual(manager.credentials(share.id), { url: share.url, passcode });
  assert.equal(manager.stop(share.id), true);
  assert.equal(manager.get(share.id), null);
  assert.equal(child.killed, true);
  await fs.rm(folder, { recursive: true, force: true });
});

test('the zip endpoint bundles a whole folder or an explicit file selection into one download', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-'));
  await fs.mkdir(path.join(folder, 'Season 1'));
  await fs.writeFile(path.join(folder, 'Season 1', 'ep1.txt'), 'episode one');
  await fs.writeFile(path.join(folder, 'Season 1', 'ep2.txt'), 'episode two');
  await fs.writeFile(path.join(folder, 'readme.txt'), 'top level file');
  const { app, share, port, cookie } = await startTestShare(folder);

  const unauthed = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip`);
  assert.equal(unauthed.status, 401);

  const whole = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip`, { headers: { cookie } });
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('content-type'), 'application/zip');
  assert.match(whole.headers.get('content-disposition'), /attachment/);
  const wholeBytes = Buffer.from(await whole.arrayBuffer());
  assert.equal(wholeBytes.subarray(0, 2).toString(), 'PK'); // zip local file header signature
  // roughly: 3 files' bytes plus zip framing overhead, well under a naive re-download of everything twice
  assert.ok(wholeBytes.length > 'episode oneepisode twotop level file'.length);

  const selectedPaths = JSON.stringify(['Season 1/ep1.txt', 'readme.txt']);
  const partial = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip?paths=${encodeURIComponent(selectedPaths)}`, { headers: { cookie } });
  assert.equal(partial.status, 200);
  const partialBytes = Buffer.from(await partial.arrayBuffer());
  assert.ok(partialBytes.length < wholeBytes.length); // excludes ep2.txt, so it must be smaller

  await app.close();
  await fs.rm(folder, { recursive: true, force: true });
});

test('the zip endpoint can bundle a whole subfolder passed as a single directory path', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-'));
  await fs.mkdir(path.join(folder, 'Season 1'));
  await fs.writeFile(path.join(folder, 'Season 1', 'ep1.txt'), 'episode one');
  await fs.writeFile(path.join(folder, 'Season 1', 'ep2.txt'), 'episode two');
  await fs.writeFile(path.join(folder, 'readme.txt'), 'top level file');
  const { app, share, port, cookie } = await startTestShare(folder);

  // Pass the directory itself, not its files.
  const subfolder = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip?paths=${encodeURIComponent(JSON.stringify(['Season 1']))}`, { headers: { cookie } });
  assert.equal(subfolder.status, 200);
  const bytes = Buffer.from(await subfolder.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  // Contains both nested files but excludes the top-level readme.
  assert.ok(bytes.includes(Buffer.from('episode one')));
  assert.ok(bytes.includes(Buffer.from('episode two')));
  assert.equal(bytes.includes(Buffer.from('top level file')), false);

  // Overlapping selection (folder + one of its files) is de-duplicated, not doubled.
  const overlap = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip?paths=${encodeURIComponent(JSON.stringify(['Season 1', 'Season 1/ep1.txt']))}`, { headers: { cookie } });
  assert.equal(overlap.status, 200);
  const overlapBytes = Buffer.from(await overlap.arrayBuffer());
  assert.equal(overlapBytes.length, bytes.length);

  await app.close();
  await fs.rm(folder, { recursive: true, force: true });
});

test('a path-traversal attempt on /zip or /file is rejected without crashing the server', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-share-'));
  await fs.writeFile(path.join(folder, 'safe.txt'), 'safe contents');
  const { app, share, port, cookie } = await startTestShare(folder);

  const traversalPaths = encodeURIComponent(JSON.stringify(['../outside.txt']));
  const zipTraversal = await fetch(`http://127.0.0.1:${port}/s/${share.id}/zip?paths=${traversalPaths}`, { headers: { cookie } });
  assert.equal(zipTraversal.status, 400);

  const fileTraversal = await fetch(`http://127.0.0.1:${port}/s/${share.id}/file/..%2Foutside.txt`, { headers: { cookie } });
  assert.equal(fileTraversal.status, 400);

  // The server must still be alive and serving requests after both rejected attempts.
  const stillAlive = await fetch(`http://127.0.0.1:${port}/s/${share.id}/file/safe.txt`, { headers: { cookie } });
  assert.equal(stillAlive.status, 200);
  assert.equal(await stillAlive.text(), 'safe contents');

  await app.close();
  await fs.rm(folder, { recursive: true, force: true });
});
