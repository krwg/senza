/** Normalize tags before library copy — avoids music/Unknown Artist/Unknown Album/. */
const path = require('path');

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';

function findTitleDash(s) {
  const separators = [' - ', ' – ', ' — '];
  let best = -1;
  let sepLen = 3;
  for (const sep of separators) {
    const idx = s.lastIndexOf(sep);
    if (idx > 0 && idx >= best) {
      best = idx;
      sepLen = sep.length;
    }
  }
  return best >= 0 ? { index: best, sepLen } : null;
}

function parseArtistTitle(base) {
  const dash = findTitleDash(String(base || '').trim());
  if (!dash) return null;
  const artist = base.slice(0, dash.index).trim();
  const title = base.slice(dash.index + dash.sepLen).trim();
  if (!artist || !title) return null;
  return { artist, title };
}

function isUnknownArtist(a) {
  const n = String(a || '').trim().toLowerCase();
  return !n || n === 'unknown artist' || n === 'unknown';
}

function isUnknownAlbum(a) {
  const n = String(a || '').trim().toLowerCase();
  return !n || n === 'unknown album' || n === 'unknown';
}

/**
 * @param {string} filePath
 * @param {object} meta — title, artist, album, ...
 */
function normalizeImportMeta(filePath, meta) {
  const out = { ...meta };
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  if (isUnknownArtist(out.artist)) {
    const fromTitle = parseArtistTitle(out.title);
    const fromBase = parseArtistTitle(base);
    const parsed = fromTitle || fromBase;
    if (parsed) {
      out.artist = parsed.artist;
      if (!out.title || out.title === base) out.title = parsed.title;
    }
  }

  if (isUnknownAlbum(out.album) && out.title) {
    const parsed = parseArtistTitle(out.title);
    if (parsed && !isUnknownArtist(parsed.artist)) {
      /* album stays unknown until glyph or folder */
    }
  }

  if (!out.title || out.title === base) {
    const parsed = parseArtistTitle(base);
    if (parsed) {
      out.title = parsed.title;
      if (isUnknownArtist(out.artist)) out.artist = parsed.artist;
    } else {
      out.title = base;
    }
  }

  return out;
}

module.exports = { normalizeImportMeta, parseArtistTitle };
