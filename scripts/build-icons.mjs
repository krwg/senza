import sharp from 'sharp';
import toIco from 'to-ico';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const publicDir = join(root, 'public');
const svgPath = join(root, 'icon.svg');

if (!existsSync(svgPath)) {
  console.error('[build-icons] icon.svg not found at project root');
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

const svg = readFileSync(svgPath);
copyFileSync(svgPath, join(buildDir, 'icon.svg'));
copyFileSync(svgPath, join(publicDir, 'icon.svg'));

const png256 = join(buildDir, 'icon.png');
const png512 = join(buildDir, 'icon-512.png');
await sharp(svg, { density: 288 }).resize(256, 256).png().toFile(png256);
await sharp(svg, { density: 288 }).resize(512, 512).png().toFile(png512);

const sizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(svg, { density: 288 }).resize(size, size).png().toBuffer())
);

const icoPath = join(buildDir, 'icon.ico');
writeFileSync(icoPath, await toIco(pngBuffers));

console.log('[build-icons] Wrote', icoPath, png256, png512, join(publicDir, 'icon.svg'));
