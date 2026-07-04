import { isVariousArtists } from '@glyph/core/sanitize.js';
import { parseLibraryPath } from '@glyph/core/library-path.js';
import { parseArtistTitle } from '@glyph/utils/artists.js';
import { basename, cleanBase } from '@glyph/core/normalize.js';

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';

function norm(v) {
  return String(v ?? '').trim();
}

function isWeak(v, key) {
  const n = norm(v);
  if (!n) return true;
  if (key === 'artist' && (n === UNKNOWN_ARTIST || isVariousArtists(n))) return true;
  if (key === 'album' && n === UNKNOWN_ALBUM) return true;
  return false;
}


export function buildTagPatch(track, suggested, { aggressive = false } = {}) {
  const patch = {};
  const path = parseLibraryPath(track.path || '');
  let sug = { ...suggested };

  if (path?.artist && !isVariousArtists(path.artist) && isVariousArtists(sug.artist)) {
    sug.artist = path.artist;
  }

  const pairs = [
    ['title', sug.title],
    ['artist', sug.artist],
    ['album', sug.album],
    ['genre', sug.genre],
    ['year', sug.year],
    ['trackNo', sug.trackNo],
  ];

  for (const [key, next] of pairs) {
    let val = norm(next);
    if (key === 'artist' && isVariousArtists(val) && path?.artist && !isVariousArtists(path.artist)) {
      val = path.artist;
    }
    if (!val) continue;
    const cur = norm(track[key]);
    if (aggressive || isWeak(track[key], key)) {
      if (!cur || cur !== val) patch[key] = val;
      continue;
    }
    if (!cur || cur !== val) patch[key] = val;
  }

  if (!patch.title && !norm(track.title) && track.path) {
    const name = basename(track.path);
    const parsed = parseArtistTitle(name);
    if (parsed?.title) patch.title = cleanBase(parsed.title) || parsed.title;
  }

  if (!patch.artist && isWeak(track.artist, 'artist') && path?.artist) {
    patch.artist = path.artist;
  }

  if (!patch.album && isWeak(track.album, 'album') && path?.album) {
    patch.album = path.album;
  }

  return patch;
}

export function countPatchFields(patch) {
  return Object.keys(patch).length;
}
