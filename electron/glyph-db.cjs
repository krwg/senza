/** Glyph 2.1 — library feature index in SQLite (glyph-log.sqlite). */
const {
  upsertTrackFeaturesSql,
  upsertManyFeaturesSql,
  getLibraryFeatureRowsSql,
} = require('./glyph-log-db.cjs');

const DIM = 64;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function titleEmbedding(title, artist) {
  const vec = new Array(DIM).fill(0);
  const tokens = [...tokenize(artist), ...tokenize(title)];
  for (const tok of tokens) {
    let h = 2166136261;
    const s = `${tok}:0`;
    for (let c = 0; c < s.length; c += 1) {
      h ^= s.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    h >>>= 0;
    const idx = h % DIM;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign * (1 + (tok.length % 5) / 5);
  }
  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

async function upsertTrackFeatures(libraryRoot, track) {
  return upsertTrackFeaturesSql(libraryRoot, track, titleEmbedding);
}

async function upsertManyTracks(libraryRoot, tracks) {
  return upsertManyFeaturesSql(libraryRoot, tracks, titleEmbedding);
}

async function getLibraryFeatureRows(libraryRoot) {
  return getLibraryFeatureRowsSql(libraryRoot);
}

async function removeTrackFeatures(libraryRoot, trackId) {
  const { getDb } = require('./glyph-log-db.cjs');
  const db = getDb(libraryRoot);
  if (!db) return { ok: false };
  db.prepare('DELETE FROM tracks_features WHERE track_id = ?').run(trackId);
  return { ok: true };
}

module.exports = {
  upsertTrackFeatures,
  upsertManyTracks,
  getLibraryFeatureRows,
  removeTrackFeatures,
  titleEmbedding,
};
