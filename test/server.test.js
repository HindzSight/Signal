import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { hashPasscode, verifyPasscode, containedPath, resolveSharedFile, ShareManager } from '../src/server.js';

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
