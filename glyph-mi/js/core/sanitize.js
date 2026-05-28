import { parseLibraryPath } from './library-path.js';
import { parseArtistTitle, splitArtists, joinArtists } from '../utils/artists.js';
import { basename, cleanBase } from './normalize.js';

const VA_NAMES = new Set([
  'various artists',
  'various',
  'va',
  'разные исполнители',
  'сборник',
]);

export function isVariousArtists(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase();
  return VA_NAMES.has(n);
}

export function isCompilationFolderArtist(name) {
  return isVariousArtists(name);
}

/** Prefer library folder + filename over bad heuristics (e.g. "va" in path). */
export function sanitizeGlyphFields(filePath, tags = {}, fields = {}) {
  const out = { ...fields };
  const path = parseLibraryPath(filePath || tags.path || '');
  const folderArtist = path?.artist?.trim() || '';
  const folderAlbum = path?.album?.trim() || '';
  const folderYear = path?.year?.trim() || '';

  if (folderArtist && !isCompilationFolderArtist(folderArtist)) {
    if (!out.artist || isVariousArtists(out.artist)) {
      out.artist = folderArtist;
      out.artists = path.artists || splitArtists(folderArtist);
    }
  }

  if (folderAlbum && (!out.album || out.album === 'Unknown Album')) {
    out.album = folderAlbum;
  }

  if (folderYear && !out.year) out.year = folderYear;

  if (isVariousArtists(out.artist) && folderArtist && !isCompilationFolderArtist(folderArtist)) {
    out.artist = folderArtist;
    out.artists = splitArtists(folderArtist);
  }

  if ((!out.artist || isVariousArtists(out.artist) || out.artist === 'Unknown Artist') && out.title) {
    const parsedFromTitle = parseArtistTitle(String(out.title));
    if (parsedFromTitle?.artist && !isVariousArtists(parsedFromTitle.artist)) {
      out.artist = joinArtists(splitArtists(parsedFromTitle.artist));
      out.artists = splitArtists(parsedFromTitle.artist);
      out.title = cleanBase(parsedFromTitle.title) || parsedFromTitle.title;
    }
  }

  if (!out.title || out.title.length < 2) {
    const fromName = basename(filePath || '');
    const parsed = parseArtistTitle(fromName);
    if (parsed?.title) out.title = cleanBase(parsed.title) || parsed.title;
    else if (fromName) out.title = cleanBase(fromName) || fromName;
  }

  if ((!out.artist || isVariousArtists(out.artist)) && !folderArtist) {
    const fromName = basename(filePath || '');
    const parsed = parseArtistTitle(fromName);
    if (parsed?.artist && !isVariousArtists(parsed.artist)) {
      out.artist = joinArtists(splitArtists(parsed.artist));
      out.artists = splitArtists(parsed.artist);
    }
  }

  if (isVariousArtists(out.artist) && !isCompilationFolderArtist(folderArtist)) {
    out.artist = '';
    out.artists = [];
  }

  if (out.artist && !out.artists?.length) {
    out.artists = splitArtists(out.artist);
  }

  return out;
}
