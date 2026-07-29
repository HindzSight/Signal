// electron-builder afterPack hook: copies the correct platform+arch cloudflared
// binary (fetched by scripts/fetch-cloudflared.mjs) into the packaged app's
// resources folder, so recipients never need to install cloudflared themselves.
//
// Not done via the declarative "extraResources" config because that requires a
// single static source path per platform block; this app builds multiple
// architectures (mac x64 + arm64) from one config, each needing a different
// binary, so a hook with access to the real per-target Arch is more reliable
// than depending on undocumented macro substitution in "from" paths.
const fs = require('fs');
const path = require('path');
const { Arch } = require('builder-util');

module.exports = async function afterPack(context) {
  const { arch, electronPlatformName, appOutDir, packager } = context;
  const platformKey = electronPlatformName === 'darwin' ? 'darwin' : electronPlatformName === 'win32' ? 'win32' : null;
  if (!platformKey) return; // only mac and windows are bundled

  const archName = Arch[arch];
  const binaryName = platformKey === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const source = path.join(__dirname, 'resources', `${platformKey}-${archName}`, binaryName);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing bundled cloudflared binary at ${source}. Run "node scripts/fetch-cloudflared.mjs ${platformKey}-${archName}" first.`);
  }

  const destDir = platformKey === 'darwin'
    ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources');
  const dest = path.join(destDir, binaryName);
  fs.copyFileSync(source, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`[afterPack] bundled cloudflared (${platformKey}-${archName}) -> ${dest}`);
};
