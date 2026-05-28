import { parseLibraryPath } from '@glyph/core/library-path.js';

const UNKNOWN_ALBUM = 'Unknown Album';

/** Infer missing album from Senza folder layout and album mates — no training required. */
export function inferAlbumForTrack(track, allTracks = []) {
  const current = String(track.album || '').trim();
  if (current && current !== UNKNOWN_ALBUM) {
    return { album: current, source: 'tag' };
  }

  const fromPath = parseLibraryPath(track.path || '');
  if (fromPath?.album) {
    return { album: fromPath.album, source: 'folder', year: fromPath.year || '' };
  }

  const artist = String(track.artist || '').trim();
  if (artist) {
    const mates = allTracks.filter(
      (t) =>
        t.id !== track.id &&
        t.artist === artist &&
        t.album &&
        t.album !== UNKNOWN_ALBUM
    );
    const counts = new Map();
    for (const m of mates) {
      counts.set(m.album, (counts.get(m.album) || 0) + 1);
    }
    let best = '';
    let bestN = 0;
    for (const [name, n] of counts) {
      if (n > bestN) {
        bestN = n;
        best = name;
      }
    }
    if (best) return { album: best, source: 'siblings' };
  }

  return { album: current || '', source: 'none' };
}

export function trackWithInferredAlbum(track, allTracks = []) {
  const { album, source, year } = inferAlbumForTrack(track, allTracks);
  const out = { ...track };
  if (album && (!out.album || out.album === UNKNOWN_ALBUM)) {
    out.album = album;
    out._albumInferred = source;
  }
  if (year && !out.year) out.year = year;
  return out;
}

export function tracksMissingAlbum(tracks) {
  return tracks.filter((t) => {
    const a = String(t.album || '').trim();
    return !a || a === UNKNOWN_ALBUM;
  });
}
