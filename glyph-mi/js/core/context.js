import { splitArtists, joinArtists } from '../utils/artists.js';

/** Infer album / artist from sibling tracks in the same import batch. */
export function consensusFromSiblings(siblings = []) {
  if (!siblings.length) return null;

  const albumCounts = new Map();
  const artistCounts = new Map();
  const genreCounts = new Map();

  for (const t of siblings) {
    if (t.album) albumCounts.set(t.album, (albumCounts.get(t.album) || 0) + 1);
    for (const a of splitArtists(t.artist)) {
      artistCounts.set(a, (artistCounts.get(a) || 0) + 1);
    }
    if (t.genre) genreCounts.set(t.genre, (genreCounts.get(t.genre) || 0) + 1);
  }

  const topAlbum = topEntry(albumCounts);
  const topArtist = topEntry(artistCounts);
  const topGenre = topEntry(genreCounts);

  if (!topAlbum && !topArtist) return null;

  return {
    album: topAlbum?.key || '',
    artist: topArtist ? joinArtists([topArtist.key]) : '',
    artists: topArtist ? [topArtist.key] : [],
    genre: topGenre?.key || '',
    reasons: [
      topAlbum ? `album consensus (${topAlbum.count}/${siblings.length})` : null,
      topArtist ? `artist consensus (${topArtist.count}/${siblings.length})` : null,
    ].filter(Boolean),
  };
}

function topEntry(map) {
  let best = null;
  for (const [key, count] of map) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

import { parseLibraryPath } from './library-path.js';

/** Music/Artist/Album from library folder path. */
export function hintFromPath(filePath) {
  const parsed = parseLibraryPath(filePath);
  if (!parsed) return null;
  return {
    artist: parsed.artist,
    album: parsed.album,
    year: parsed.year,
    artists: parsed.artists,
    reasons: parsed.reasons,
  };
}
