#!/usr/bin/env node
/** Push Senza Dev/glyph-mi → Floke Dev/Glyph-MI (js + models). */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const senzaRoot = path.resolve(__dirname, '..');
const source = path.join(senzaRoot, 'glyph-mi');
const dest = path.resolve(senzaRoot, '../Glyph-MI');

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function main() {
  for (const dir of ['js', 'models']) {
    const src = path.join(source, dir);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    await copyDir(src, path.join(dest, dir));
    console.log('Pushed', dir);
  }
  console.log('Done →', dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
