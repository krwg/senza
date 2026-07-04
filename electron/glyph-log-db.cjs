const path = require('path');
const fs = require('fs');
const { glyphDir, ensureGlyphDirs } = require('./glyph-learn.cjs');

let Database = null;
try {
  Database = require('better-sqlite3');
} catch {
  Database = null;
}

const { pathToFileURL } = require('url');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS glyph_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  project     TEXT NOT NULL,
  agent       TEXT NOT NULL,
  event       TEXT NOT NULL,
  input       TEXT,
  suggestion  TEXT,
  outcome     TEXT,
  confidence  REAL,
  sources     TEXT,
  accepted    INTEGER,
  edited      INTEGER,
  context     TEXT
);
CREATE INDEX IF NOT EXISTS idx_glyph_log_ts ON glyph_log(ts);
CREATE INDEX IF NOT EXISTS idx_glyph_log_event ON glyph_log(event);
CREATE TABLE IF NOT EXISTS glyph_diff (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id      INTEGER NOT NULL,
  field       TEXT NOT NULL,
  val_before  TEXT,
  val_glyph   TEXT,
  val_after   TEXT,
  accepted    INTEGER,
  FOREIGN KEY (log_id) REFERENCES glyph_log(id)
);
CREATE INDEX IF NOT EXISTS idx_glyph_diff_log ON glyph_diff(log_id);
CREATE TABLE IF NOT EXISTS tracks_features (
  track_id    TEXT PRIMARY KEY,
  title       TEXT,
  artist_norm TEXT,
  album       TEXT,
  genre       TEXT,
  bpm         REAL,
  energy      REAL,
  brightness  REAL,
  mood        TEXT,
  title_vec   TEXT,
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tracks_features_artist ON tracks_features(artist_norm);
CREATE INDEX IF NOT EXISTS idx_tracks_features_genre ON tracks_features(genre);
`;

let loggerMod = null;
async function getLoggerMod() {
  if (!loggerMod) {
    const p = path.join(__dirname, '../glyph-mi/js/core/logger.js');
    loggerMod = await import(pathToFileURL(p).href);
  }
  return loggerMod;
}

const dbs = new Map();

function dbPath(libraryRoot) {
  return path.join(glyphDir(libraryRoot), 'glyph-log.sqlite');
}

function getDb(libraryRoot) {
  if (!Database) return null;
  const key = path.resolve(libraryRoot);
  if (dbs.has(key)) return dbs.get(key);

  ensureGlyphDirs(libraryRoot);
  const p = dbPath(libraryRoot);
  const db = new Database(p);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  migrateTracksJsonToSqlite(db, libraryRoot);
  dbs.set(key, db);
  return db;
}

function migrateTracksJsonToSqlite(db, libraryRoot) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM tracks_features').get().n;
  if (count > 0) return;
  const jsonPath = path.join(glyphDir(libraryRoot), 'tracks-features.json');
  if (!fs.existsSync(jsonPath)) return;
  try {
    const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(rows) || !rows.length) return;
    const ins = db.prepare(`
      INSERT OR REPLACE INTO tracks_features
      (track_id, title, artist_norm, album, genre, bpm, energy, brightness, mood, title_vec, updated_at)
      VALUES (@track_id, @title, @artist_norm, @album, @genre, @bpm, @energy, @brightness, @mood, @title_vec, @updated_at)
    `);
    const tx = db.transaction((list) => {
      for (const r of list) {
        ins.run({
          track_id: r.track_id,
          title: r.title || '',
          artist_norm: r.artist_norm || '',
          album: r.album || '',
          genre: r.genre || '',
          bpm: r.bpm ?? 0,
          energy: r.energy ?? 0.12,
          brightness: r.brightness ?? 1400,
          mood: r.mood || '',
          title_vec: JSON.stringify(r.title_vec || []),
          updated_at: Date.now(),
        });
      }
    });
    tx(rows);
    fs.renameSync(jsonPath, `${jsonPath}.migrated`);
  } catch {
    
  }
}

function rowToFeature(r) {
  let title_vec = [];
  try {
    title_vec = JSON.parse(r.title_vec || '[]');
  } catch {
    title_vec = [];
  }
  return {
    track_id: r.track_id,
    title: r.title,
    artist_norm: r.artist_norm,
    album: r.album,
    genre: r.genre,
    bpm: r.bpm,
    energy: r.energy,
    brightness: r.brightness,
    mood: r.mood,
    title_vec,
  };
}

function upsertTrackFeaturesSql(libraryRoot, track, titleEmbeddingFn) {
  const db = getDb(libraryRoot);
  if (!db || !track?.id) return { ok: false };
  const g = track.glyph || {};
  const vec = titleEmbeddingFn(track.title, track.artist);
  db.prepare(`
    INSERT OR REPLACE INTO tracks_features
    (track_id, title, artist_norm, album, genre, bpm, energy, brightness, mood, title_vec, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    track.id,
    track.title || '',
    String(track.artist || '')
      .trim()
      .toLowerCase(),
    track.album || '',
    track.genre || '',
    g.bpm ?? track.bpm ?? 0,
    g.energy ?? 0.12,
    g.brightness ?? 1400,
    g.mood || '',
    JSON.stringify(vec),
    Date.now()
  );
  return { ok: true };
}

function upsertManyFeaturesSql(libraryRoot, tracks, titleEmbeddingFn) {
  const db = getDb(libraryRoot);
  if (!db) return { ok: false, count: 0 };
  const ins = db.prepare(`
    INSERT OR REPLACE INTO tracks_features
    (track_id, title, artist_norm, album, genre, bpm, energy, brightness, mood, title_vec, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((list) => {
    for (const tr of list) {
      if (!tr?.id) continue;
      const g = tr.glyph || {};
      const vec = titleEmbeddingFn(tr.title, tr.artist);
      ins.run(
        tr.id,
        tr.title || '',
        String(tr.artist || '')
          .trim()
          .toLowerCase(),
        tr.album || '',
        tr.genre || '',
        g.bpm ?? tr.bpm ?? 0,
        g.energy ?? 0.12,
        g.brightness ?? 1400,
        g.mood || '',
        JSON.stringify(vec),
        Date.now()
      );
    }
  });
  tx(tracks || []);
  const count = db.prepare('SELECT COUNT(*) AS n FROM tracks_features').get().n;
  return { ok: true, count };
}

function getLibraryFeatureRowsSql(libraryRoot) {
  const db = getDb(libraryRoot);
  if (!db) return [];
  return db.prepare('SELECT * FROM tracks_features').all().map(rowToFeature);
}

function getAnalytics(libraryRoot, { trackCount = 0 } = {}) {
  const db = getDb(libraryRoot);
  if (!db) return { ok: false };
  const indexed = db.prepare('SELECT COUNT(*) AS n FROM tracks_features').get().n;
  const avgConf =
    db.prepare(
      `SELECT AVG(confidence) AS a FROM glyph_log WHERE event IN ('glyph.suggest','glyph.auto') AND confidence IS NOT NULL`
    ).get().a || 0;
  const counterexamples = db
    .prepare(
      `SELECT COUNT(*) AS n FROM glyph_diff
       WHERE val_glyph IS NOT NULL AND val_after IS NOT NULL AND val_glyph != val_after`
    )
    .get().n;
  const ollamaCalls = db.prepare(`SELECT COUNT(*) AS n FROM glyph_log WHERE event = 'glyph.ollama'`).get().n;
  const ollamaUseful = db
    .prepare(
      `SELECT COUNT(*) AS n FROM glyph_log WHERE event = 'glyph.ollama' AND accepted = 1`
    )
    .get().n;
  const sourceRows = db
    .prepare(
      `SELECT sources FROM glyph_log WHERE sources IS NOT NULL ORDER BY ts DESC LIMIT 5000`
    )
    .all();
  const sourceCounts = {};
  for (const row of sourceRows) {
    const arr = safeParse(row.sources);
    if (!Array.isArray(arr)) continue;
    for (const s of arr) sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const byEvent = db
    .prepare('SELECT event, COUNT(*) AS n FROM glyph_log GROUP BY event ORDER BY n DESC')
    .all();
  const logTotal = db.prepare('SELECT COUNT(*) AS n FROM glyph_log').get().n;
  const diffTotal = db.prepare('SELECT COUNT(*) AS n FROM glyph_diff').get().n;
  const p = dbPath(libraryRoot);
  let bytes = 0;
  if (fs.existsSync(p)) bytes = fs.statSync(p).size;
  return {
    ok: true,
    indexed,
    trackCount: trackCount || indexed,
    avgConfidence: Math.round(avgConf * 10) / 10,
    counterexamples,
    ollamaCalls,
    ollamaUseful,
    topSources,
    logTotal,
    diffTotal,
    bytes,
    byEvent,
  };
}

async function logEvent(libraryRoot, payload) {
  const db = getDb(libraryRoot);
  if (!db) return { ok: false, reason: 'sqlite-unavailable' };

  const { normalizeLogPayload } = await getLoggerMod();
  const { logRow, diffRows } = normalizeLogPayload(payload);

  const insertLog = db.prepare(`
    INSERT INTO glyph_log
    (ts, project, agent, event, input, suggestion, outcome,
     confidence, sources, accepted, edited, context)
    VALUES
    (@ts, @project, @agent, @event, @input, @suggestion, @outcome,
     @confidence, @sources, @accepted, @edited, @context)
  `);

  const insertDiff = db.prepare(`
    INSERT INTO glyph_diff
    (log_id, field, val_before, val_glyph, val_after, accepted)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const info = insertLog.run(logRow);
    const logId = info.lastInsertRowid;
    for (const row of diffRows) {
      insertDiff.run(logId, row.field, row.val_before, row.val_glyph, row.val_after, row.accepted);
    }
    return logId;
  });

  const logId = tx();
  return { ok: true, logId, diffCount: diffRows.length };
}

function getLogStats(libraryRoot) {
  const db = getDb(libraryRoot);
  if (!db) {
    return { ok: false, sqlite: false, path: dbPath(libraryRoot) };
  }
  const total = db.prepare('SELECT COUNT(*) AS n FROM glyph_log').get().n;
  const diffs = db.prepare('SELECT COUNT(*) AS n FROM glyph_diff').get().n;
  const byEvent = db
    .prepare('SELECT event, COUNT(*) AS n FROM glyph_log GROUP BY event ORDER BY n DESC')
    .all();
  const p = dbPath(libraryRoot);
  let bytes = 0;
  if (fs.existsSync(p)) bytes = fs.statSync(p).size;
  return { ok: true, sqlite: true, path: p, total, diffs, bytes, byEvent };
}

function exportDataset(libraryRoot, { onlyAccepted = true, limit = 0 } = {}) {
  const db = getDb(libraryRoot);
  if (!db) return { ok: false, lines: [] };

  let sql = `
    SELECT l.*, d.field, d.val_before, d.val_glyph, d.val_after, d.accepted AS diff_accepted
    FROM glyph_log l
    JOIN glyph_diff d ON d.log_id = l.id
  `;
  if (onlyAccepted) sql += ' WHERE l.accepted = 1';
  sql += ' ORDER BY l.ts ASC';
  if (limit > 0) sql += ` LIMIT ${Number(limit)}`;

  const rows = db.prepare(sql).all();
  const lines = rows.map((r) =>
    JSON.stringify({
      ts: r.ts,
      project: r.project,
      agent: r.agent,
      event: r.event,
      input: safeParse(r.input),
      context: safeParse(r.context),
      field: r.field,
      before: r.val_before,
      suggested: r.val_glyph,
      accepted: r.val_after,
      diffAccepted: r.diff_accepted,
      confidence: r.confidence,
      sources: safeParse(r.sources),
    })
  );
  return { ok: true, lines, count: lines.length };
}

async function writeDatasetExport(libraryRoot, { onlyAccepted = true } = {}) {
  const { lines, count } = exportDataset(libraryRoot, { onlyAccepted });
  await ensureGlyphDirs(libraryRoot);
  const outDir = path.join(glyphDir(libraryRoot), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `glyph-dataset-${stamp}.jsonl`);
  fs.writeFileSync(outPath, lines.join('\n) + (lines.length ? '\n' : ''), 'utf8');
  return { path: outPath, count };
}

function safeParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function closeAll() {
  for (const db of dbs.values()) {
    try {
      db.close();
    } catch {
      void 0;
    }
  }
  dbs.clear();
}

module.exports = {
  getDb,
  logEvent,
  getLogStats,
  getAnalytics,
  exportDataset,
  writeDatasetExport,
  upsertTrackFeaturesSql,
  upsertManyFeaturesSql,
  getLibraryFeatureRowsSql,
  closeAll,
  dbPath,
};
