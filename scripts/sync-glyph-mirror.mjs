#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const senzaRoot = path.resolve(__dirname, '..');
const source = path.resolve(senzaRoot, '../../Glyph-MI');
const dest = path.join(senzaRoot, 'glyph-mi');

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
  for (const dir of ['js', 'glyph_mi']) {
    await copyDir(path.join(source, dir), path.join(dest, dir));
    console.log('Synced', dir);
  }
  await copyDir(path.join(source, 'knowledge', 'public'), path.join(dest, 'knowledge', 'public'));
  console.log('Synced knowledge/public');
  console.log('Done →', dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
