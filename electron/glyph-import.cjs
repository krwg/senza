const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { exportsDir } = require('./glyph-learn.cjs');

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

async function findLatestExport(libraryRoot) {
  const base = exportsDir(libraryRoot);
  if (!fsSync.existsSync(base)) return null;
  const entries = await fs.readdir(base, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('glyph-export-'))
    .map((e) => e.name)
    .sort()
    .reverse();
  return folders[0] ? path.join(base, folders[0]) : null;
}

async function importExportToPrivatePack(libraryRoot, { exportDir } = {}) {
  const dir = exportDir || (await findLatestExport(libraryRoot));
  if (!dir) throw new Error('No glyph export folder found');

  const jsonlPath = path.join(dir, 'learn.jsonl');
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

  const packRoot = path.resolve(__dirname, '../glyph-mi/knowledge/private');
  await fs.mkdir(packRoot, { recursive: true });
  const outFile = path.join(packRoot, 'user-learned-v1.json');

  const pack = {
    format: 'glyph-knowledge-pack',
    version: 1,
    id: 'senza-user-learned-v1',
    description: `Imported from ${path.basename(dir)} — ${examples.length} examples`,
    importedAt: new Date().toISOString(),
    sourceExport: path.basename(dir),
    examples,
    artistAliases: [],
    genreHints: [],
    junkPatterns: [],
  };

  await fs.writeFile(outFile, JSON.stringify(pack, null, 2), 'utf8');
  return { ok: true, outFile, exampleCount: examples.length, exportDir: dir };
}

module.exports = { importExportToPrivatePack, findLatestExport };
