const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const fsSync = require('fs');

function glyphDir(libraryRoot) {
  return path.join(libraryRoot, 'glyph');
}

function logPath(libraryRoot) {
  return path.join(glyphDir(libraryRoot), 'learn.jsonl');
}

function exportsDir(libraryRoot) {
  return path.join(glyphDir(libraryRoot), 'exports');
}

function knowledgeDir(libraryRoot) {
  return path.join(glyphDir(libraryRoot), 'knowledge');
}

async function ensureGlyphDirs(libraryRoot) {
  await fs.mkdir(exportsDir(libraryRoot), { recursive: true });
  await fs.mkdir(knowledgeDir(libraryRoot), { recursive: true });
  const lp = logPath(libraryRoot);
  if (!fsSync.existsSync(lp)) {
    await fs.writeFile(lp, '', 'utf8');
  }
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

function trackRef(track, libraryRoot) {
  const musicRoot = path.join(libraryRoot, 'music');
  let rel = track.path || '';
  try {
    rel = path.relative(musicRoot, track.path);
  } catch {
    rel = path.basename(track.path || '');
  }
  return {
    basename: path.basename(track.path || ''),
    rel: String(rel).replace(/\\/g, '/'),
  };
}

function pickTags(obj) {
  if (!obj) return {};
  return {
    title: obj.title ?? '',
    artist: obj.artist ?? '',
    album: obj.album ?? '',
    genre: obj.genre ?? '',
    year: obj.year ?? '',
    trackNo: obj.trackNo ?? '',
  };
}

async function appendLearnEntry(libraryRoot, entry) {
  await ensureGlyphDirs(libraryRoot);
  const line =
    JSON.stringify({
      id: newId(),
      ts: new Date().toISOString(),
      v: 1,
      ...entry,
    }) + '\n;
  await fs.appendFile(logPath(libraryRoot), line, 'utf8');
}

async function readLearnEntries(libraryRoot, { limit = 5000 } = {}) {
  const lp = logPath(libraryRoot);
  if (!fsSync.existsSync(lp)) return [];
  const raw = await fs.readFile(lp, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const slice = limit > 0 ? lines.slice(-limit) : lines;
  const out = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line));
    } catch {
      void 0;
    }
  }
  return out;
}

async function getLearnStats(libraryRoot) {
  const entries = await readLearnEntries(libraryRoot, { limit: 0 });
  const byEvent = {};
  for (const e of entries) {
    const k = e.event || 'unknown';
    byEvent[k] = (byEvent[k] || 0) + 1;
  }
  let bytes = 0;
  const lp = logPath(libraryRoot);
  if (fsSync.existsSync(lp)) {
    bytes = fsSync.statSync(lp).size;
  }
  return {
    total: entries.length,
    bytes,
    byEvent,
    logPath: lp,
    exportsDir: exportsDir(libraryRoot),
  };
}

async function exportLearnBundle(libraryRoot, { contributorId = '', note = '' } = {}) {
  await ensureGlyphDirs(libraryRoot);
  const entries = await readLearnEntries(libraryRoot, { limit: 0 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const folder = path.join(exportsDir(libraryRoot), `glyph-export-${stamp}`);
  await fs.mkdir(folder, { recursive: true });

  const manifest = {
    format: 'senza-glyph-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    contributorId: contributorId || 'anonymous',
    note,
    entryCount: entries.length,
  };

  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const jsonl = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
  await fs.writeFile(path.join(folder, 'learn.jsonl'), jsonl, 'utf8');

  return { folder, manifest, entryCount: entries.length };
}

function buildEntryFromTrack(track, libraryRoot, payload) {
  return {
    ...payload,
    trackId: track.id,
    ref: trackRef(track, libraryRoot),
  };
}

module.exports = {
  ensureGlyphDirs,
  appendLearnEntry,
  readLearnEntries,
  getLearnStats,
  exportLearnBundle,
  buildEntryFromTrack,
  pickTags,
  glyphDir,
  logPath,
  exportsDir,
  knowledgeDir,
};
