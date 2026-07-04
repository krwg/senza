#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function pickTags(obj) {
  if (!obj) return {};
  return {
    title: String(obj.title ?? '').trim(),
    artist: String(obj.artist ?? '').trim(),
    album: String(obj.album ?? '').trim(),
    genre: String(obj.genre ?? '').trim(),
    year: obj.year != null && obj.year !== '' ? String(obj.year) : '',
    trackNo: obj.trackNo != null && obj.trackNo !== '' ? String(obj.trackNo) : '',
  };
}

async function findLatestExport(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('glyph-export-'))
    .map((e) => e.name)
    .sort()
    .reverse();
  return folders[0] ? path.join(dir, folders[0]) : null;
}

async function main() {
  const arg = process.argv[2];
  let exportDir = arg ? path.resolve(arg) : null;

  if (!exportDir) {
    const appData = process.env.APPDATA || '';
    const candidates = [
      path.join(appData, 'senza', 'library', 'glyph', 'exports'),
      path.join(appData, 'Senza', 'library', 'glyph', 'exports'),
    ];
    for (const base of candidates) {
      try {
        exportDir = await findLatestExport(base);
        if (exportDir) break;
      } catch {
        
      }
    }
  }

  if (!exportDir) {
    console.error('Export folder not found. Pass path: node scripts/glyph-import-export.mjs <glyph-export-folder>');
    process.exit(1);
  }

  const jsonlPath = path.join(exportDir, 'learn.jsonl');
  const raw = await fs.readFile(jsonlPath, 'utf8');
  const lines = raw.split('\n).filter(Boolean);
  const examples = [];
  const seen = new Set();

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const ref = entry.ref || {};
    const before = pickTags(entry.before);
    const after = pickTags(entry.after || entry.suggested);
    if (!after.title && !after.artist) continue;

    const key = `${ref.basename || ''}|${before.title}|${after.title}|${after.artist}`;
    if (seen.has(key)) continue;
    seen.add(key);

    examples.push({
      ref: { basename: ref.basename || '', rel: ref.rel || '' },
      before,
      after,
      event: entry.event,
    });
  }

  const outDir = path.join(root, 'glyph-mi', 'knowledge', 'private');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'user-learned-v1.json');

  const pack = {
    format: 'glyph-knowledge-pack',
    version: 1,
    id: 'senza-user-learned-v1',
    description: `Imported from ${path.basename(exportDir)} — ${examples.length} curated examples`,
    importedAt: new Date().toISOString(),
    sourceExport: path.basename(exportDir),
    examples,
    artistAliases: [],
    genreHints: [],
    junkPatterns: [],
  };

  await fs.writeFile(outFile, JSON.stringify(pack, null, 2), 'utf8');
  console.log(`Wrote ${examples.length} examples → ${outFile}`);
  console.log('Add to src/js/glyph-knowledge-packs.js if you want them in the app build.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
