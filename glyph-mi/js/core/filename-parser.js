/**
 * Aggressive filename → metadata (Glyph 2.0).
 * Handles junk from downloads: [4K], type beat, slowed+reverb, etc.
 */
import { parseArtistTitle, splitArtists, joinArtists } from '../utils/artists.js';
import { basename as baseFromPath, extractYear, extractTrackNo } from './normalize.js';
import { stripFilenameJunk } from './junk-strip.js';

const TYPE_BEAT = /^\s*(.+?)\s+type\s+beat\s*[-–—:]\s*(.+)$/i;
const UNDERSCORE_ARTIST = /^([a-z0-9]+)_+(.+)$/i;

export function parseFilenameMetadata(filePath) {
  const reasons = [];
  const base = stripFilenameJunk(baseFromPath(filePath));
  if (!base) return { fields: {}, reasons };

  const year = extractYear(base);
  const trackNo = extractTrackNo(base);
  let work = base.replace(/\b(19|20)\d{2}\b/g, '').trim();

  const typeBeat = work.match(TYPE_BEAT);
  if (typeBeat) {
    reasons.push('type beat pattern');
    return {
      fields: {
        title: typeBeat[2].trim(),
        artist: 'Unknown Artist',
        album: '',
        genre: 'Hip-Hop',
        year,
        trackNo,
        artists: [],
      },
      reasons,
    };
  }

  const under = work.match(UNDERSCORE_ARTIST);
  if (under && under[1].length >= 2 && under[2].length >= 2) {
    const artist = under[1].replace(/_/g, ' ').trim();
    const title = under[2].replace(/_/g, ' ').trim();
    reasons.push('underscore artist-title');
    return {
      fields: {
        title,
        artist,
        artists: splitArtists(artist),
        album: '',
        genre: '',
        year,
        trackNo,
      },
      reasons,
    };
  }

  const parsed = parseArtistTitle(work);
  if (parsed) {
    reasons.push('artist–title filename pattern');
    return {
      fields: {
        title: parsed.title,
        artist: parsed.artist,
        artists: parsed.artists,
        album: '',
        genre: '',
        year,
        trackNo,
      },
      reasons,
    };
  }

  reasons.push('filename as title');
  return {
    fields: {
      title: work,
      artist: '',
      artists: [],
      album: '',
      genre: '',
      year,
      trackNo,
    },
    reasons,
  };
}

export function mergeFilenameIntoFields(existing, filePath) {
  const parsed = parseFilenameMetadata(filePath);
  const out = { ...existing };
  const rs = [...(existing._reasons || [])];
  for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
    const next = parsed.fields[key];
    const cur = String(out[key] || '').trim();
    if (!next) continue;
    const weak =
      !cur ||
      cur === 'Unknown Artist' ||
      cur === 'Unknown Album' ||
      cur === 'Unknown Title';
    if (weak || (key === 'title' && cur.includes(' - ') && !parsed.fields.artist)) {
      out[key] = key === 'artist' ? joinArtists(parsed.fields.artists || splitArtists(next)) : next;
      rs.push(...parsed.reasons.map((r) => `filename: ${r}`));
    }
  }
  out._reasons = rs;
  return out;
}
