// Renders the SIGNAL beacon mark (see frontend/src/components/BeaconMark.tsx) as a
// 1024x1024 raster icon, then converts it to the .icns/.ico formats electron-builder
// needs. Pure pixel math + png2icons: no headless browser or native macOS tools
// required, so this runs the same on any platform, including CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import * as png2icons from 'png2icons';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'build');
const SIZE = 1024;
const CENTER = SIZE / 2;

const INK = [20, 17, 13];       // #14110d - warm ink backdrop
const SIGNAL = [255, 122, 41];  // #ff7a29 - primary amber
const GLOW = [255, 171, 82];    // #ffab52 - bright amber-glow

function lerp(a, b, t) { return a + (b - a) * t; }
function mixColor(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

function setPixel(png, x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const idx = (SIZE * y + x) << 2;
  // Alpha-blend onto whatever is already there so overlapping rings/glow compose correctly.
  const existingA = png.data[idx + 3] / 255;
  const outA = a + existingA * (1 - a);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    const existing = png.data[idx + c];
    const value = [r, g, b][c];
    png.data[idx + c] = Math.round((value * a + existing * existingA * (1 - a)) / outA);
  }
  png.data[idx + 3] = Math.round(outA * 255);
}

function ringAlpha(dist, radius, thickness) {
  const d = Math.abs(dist - radius);
  if (d > thickness / 2) return 0;
  return 1 - d / (thickness / 2); // soft-edged ring, full opacity at its center line
}

const png = new PNG({ width: SIZE, height: SIZE });
png.data.fill(0); // start fully transparent

const backdropRadius = SIZE * 0.46;
const glowRadius = backdropRadius + SIZE * 0.035;
const rings = [SIZE * 0.16, SIZE * 0.235, SIZE * 0.315].map(r => ({ radius: r, thickness: SIZE * 0.022 }));
const coreRadius = SIZE * 0.11;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - CENTER, dy = y - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= glowRadius && dist > backdropRadius) {
      const t = 1 - (dist - backdropRadius) / (glowRadius - backdropRadius);
      setPixel(png, x, y, SIGNAL, t * 0.35);
    }
    if (dist <= backdropRadius) setPixel(png, x, y, INK, 1);

    for (const ring of rings) {
      const a = ringAlpha(dist, ring.radius, ring.thickness);
      if (a > 0) setPixel(png, x, y, SIGNAL, a);
    }

    if (dist <= coreRadius) {
      const glowColor = mixColor(GLOW, SIGNAL, Math.min(1, dist / coreRadius));
      setPixel(png, x, y, glowColor, 1);
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const pngBuffer = PNG.sync.write(png);
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), pngBuffer);

const icns = png2icons.createICNS(pngBuffer, png2icons.BILINEAR, 0);
if (icns) fs.writeFileSync(path.join(OUT_DIR, 'icon.icns'), icns);

const ico = png2icons.createICO(pngBuffer, png2icons.BILINEAR, 0, true, true);
if (ico) fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);

console.log('Wrote build/icon.png, icon.icns, icon.ico');
