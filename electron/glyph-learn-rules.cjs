/**
 * Inductive learned rules + 60-day decay (Glyph 2.1).
 */
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { readLearnEntries, knowledgeDir, ensureGlyphDirs } = require('./glyph-learn.cjs');
const { getDb, safeParse: parseJson } = require('./glyph-learn-rules-db.cjs');

const OUT_NAME = 'learned-user.json';
const MIN_SUPPORT = 3;
const DECAY_DAYS = 60;

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function pathSegment(rel, index) {
  const parts = String(rel || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[index] ? norm(parts[index]) : '';
}

function decayWeight(rawCount, lastTs) {
  if (!lastTs) return rawCount;
  const days = (Date.now() - lastTs) / 86400000;
  if (days <= DECAY_DAYS) return rawCount;
  const periods = Math.floor(days / DECAY_DAYS);
  return rawCount * Math.pow(0.5, periods);
}

function addWeighted(map, key, genreOrArtist, ts, value) {
  if (!key) return;
  const bucket = map.get(key) || { counts: new Map(), lastTs: 0 };
  const w = decayWeight(1, ts);
  const cur = bucket.counts.get(genreOrArtist) || 0;
  bucket.counts.set(genreOrArtist, cur + w);
  bucket.lastTs = Math.max(bucket.lastTs, ts || 0);
  map.set(key, bucket);
}

function pickBest(bucket) {
  let best = '';
  let bestW = 0;
  for (const [k, w] of bucket.counts) {
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return { value: best, weight: bestW };
}

function extractPatternsFromEntries(entries) {
  const genreByFolder = new Map();
  const artistByBasename = new Map();

  for (const e of entries) {
    const ev = String(e.event || '');
    if (!ev.includes('apply') && ev !== 'tag-save' && ev !== 'tag_save') continue;
    const ts = e.ts ? Date.parse(e.ts) : Date.now();
    const after = e.after || e.suggested || {};
    const rel = e.ref?.rel || '';
    const base = norm(e.ref?.basename || '');

    const folderArtist = pathSegment(rel, 0);
    const folderAlbum = pathSegment(rel, 1);
    const genre = String(after.genre || '').trim();
    const artist = String(after.artist || '').trim();

    if (folderArtist && genre) addWeighted(genreByFolder, `folder:${folderArtist}`, genre, ts, 1);
    if (folderAlbum && genre) addWeighted(genreByFolder, `album:${folderAlbum}`, genre, ts, 1);

    if (base && artist && artist !== 'unknown artist') {
      const prefix = base.split(' - ')[0]?.slice(0, 24);
      if (prefix && prefix.length >= 3) {
        addWeighted(artistByBasename, `base:${prefix}`, artist, ts, 1);
      }
    }
  }

  return { genreByFolder, artistByBasename };
}

function extractPatternsFromSqlite(libraryRoot) {
  const db = getDb(libraryRoot);
  if (!db) return { genreByFolder: new Map(), artistByBasename: new Map() };

  const genreByFolder = new Map();
  const artistByBasename = new Map();
  const rows = db
    .prepare(
      `SELECT ts, input, outcome FROM glyph_log
       WHERE event LIKE 'glyph.apply%' OR event = 'glyph.auto'`
    )
    .all();

  for (const row of rows) {
    const input = parseJson(row.input);
    const outcome = parseJson(row.outcome);
    const tags = outcome?.fields || {};
    const rel = String(input?.path || '')
      .replace(/^.*[/\\]music[/\\]/i, '')
      .replace(/\\/g, '/');
    const base = norm(input?.path?.split(/[/\\]/).pop() || '');
    const ts = row.ts;
    const genre = String(tags.genre || '').trim();
    const artist = String(tags.artist || '').trim();
    const folderArtist = pathSegment(rel, 0);
    const folderAlbum = pathSegment(rel, 1);
    if (folderArtist && genre) addWeighted(genreByFolder, `folder:${folderArtist}`, genre, ts, 1);
    if (folderAlbum && genre) addWeighted(genreByFolder, `album:${folderAlbum}`, genre, ts, 1);
    if (base && artist) {
      const prefix = base.split(' - ')[0]?.slice(0, 24);
      if (prefix?.length >= 3) addWeighted(artistByBasename, `base:${prefix}`, artist, ts, 1);
    }
  }
  return { genreByFolder, artistByBasename };
}

function mapsToPack(genreByFolder, artistByBasename, meta = {}) {
  const folderRules = [];
  const artistAliases = [];
  const genreHints = [];

  for (const [key, bucket] of genreByFolder) {
    const { value, weight } = pickBest(bucket);
    if (weight < MIN_SUPPORT || !value) continue;
    const match = key.replace(/^(folder|album):/, '');
    folderRules.push({ match, genre: value, mode: key.startsWith('album:') ? 'path' : 'folder', weight });
    genreHints.push({ pattern: match, genre: value });
  }

  for (const [key, bucket] of artistByBasename) {
    const { value, weight } = pickBest(bucket);
    if (weight < MIN_SUPPORT || !value) continue;
    const match = key.replace(/^base:/, '');
    artistAliases.push({ match, artist: value, mode: 'basename', force: false, weight });
  }

  return {
    id: 'learned-user',
    version: 2,
    builtAt: new Date().toISOString(),
    source: 'glyph-learn-inductive',
    decayDays: DECAY_DAYS,
    folderRules,
    artistAliases,
    genreHints,
    titleCleanup: [],
    junkPatterns: [],
    ...meta,
  };
}

async function rebuildLearnedPack(libraryRoot) {
  await ensureGlyphDirs(libraryRoot);
  const entries = await readLearnEntries(libraryRoot, { limit: 0 });
  const fromJsonl = extractPatternsFromEntries(entries);
  const fromSql = extractPatternsFromSqlite(libraryRoot);

  const mergeMaps = (a, b) => {
    const out = new Map(a);
    for (const [k, bucket] of b) {
      const existing = out.get(k) || { counts: new Map(), lastTs: 0 };
      for (const [val, w] of bucket.counts) {
        existing.counts.set(val, (existing.counts.get(val) || 0) + w);
      }
      existing.lastTs = Math.max(existing.lastTs, bucket.lastTs);
      out.set(k, existing);
    }
    return out;
  };

  const pack = mapsToPack(
    mergeMaps(fromJsonl.genreByFolder, fromSql.genreByFolder),
    mergeMaps(fromJsonl.artistByBasename, fromSql.artistByBasename),
    { entryCount: entries.length }
  );

  const dir = knowledgeDir(libraryRoot);
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, OUT_NAME);
  await fs.writeFile(outPath, JSON.stringify(pack, null, 2), 'utf8');
  return {
    path: outPath,
    pack,
    ruleCount: pack.folderRules.length + pack.artistAliases.length,
  };
}

async function loadLearnedPack(libraryRoot) {
  const p = path.join(knowledgeDir(libraryRoot), OUT_NAME);
  if (!fsSync.existsSync(p)) return null;
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { rebuildLearnedPack, loadLearnedPack, DECAY_DAYS };
