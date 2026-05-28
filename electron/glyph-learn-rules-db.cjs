/** Shared DB accessor for learn-rules (avoids circular deps). */
const { getDb: getLogDb } = require('./glyph-log-db.cjs');

function getDb(libraryRoot) {
  return getLogDb(libraryRoot);
}

function safeParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = { getDb, safeParse };
