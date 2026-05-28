import { parseArtistTitle, splitArtists, joinArtists } from '../utils/artists.js';
import { basename, cleanBase } from '../core/normalize.js';
import { parseFilenameMetadata } from '../core/filename-parser.js';
import { buildConfidence } from '../core/confidence.js';
import { consensusFromSiblings, hintFromPath } from '../core/context.js';

function fromFilename(filePath) {
  const parsed = parseFilenameMetadata(filePath);
  const fields = parsed.fields || {};
  const artists = fields.artists?.length ? fields.artists : splitArtists(fields.artist || '');
  return {
    title: cleanBase(fields.title) || fields.title || '',
    artist: fields.artist ? joinArtists(artists) : '',
    artists,
    album: fields.album || '',
    genre: fields.genre || '',
    year: fields.year || '',
    trackNo: fields.trackNo || '',
    reasons: parsed.reasons || [],
  };
}

function fromExistingTags(tags = {}) {
  const artists = splitArtists(tags.artist || '');
  const reasons = [];
  if (tags.title) reasons.push('existing title tag');
  if (artists.length) reasons.push('existing artist tag');
  if (tags.album) reasons.push('existing album tag');

  return {
    title: tags.title || '',
    artist: joinArtists(artists),
    artists,
    album: tags.album || '',
    genre: tags.genre || '',
    year: tags.year ? String(tags.year) : '',
    trackNo: tags.trackNo ? String(tags.trackNo) : '',
    reasons,
  };
}

function mergeFields(...sources) {
  const out = {
    title: '',
    artist: '',
    artists: [],
    album: '',
    genre: '',
    year: '',
    trackNo: '',
  };
  const reasons = [];

  for (const src of sources) {
    if (!src) continue;
    if (!out.title && src.title) out.title = src.title;
    if (!out.artist && src.artist) {
      out.artist = src.artist;
      out.artists = src.artists || splitArtists(src.artist);
    }
    if (!out.album && src.album) out.album = src.album;
    if (!out.genre && src.genre) out.genre = src.genre;
    if (!out.year && src.year) out.year = src.year;
    if (!out.trackNo && src.trackNo) out.trackNo = src.trackNo;
    if (src.reasons) reasons.push(...src.reasons);
  }

  return { ...out, reasons };
}

export function analyzeRules(input) {
  const filePath = input.filePath || '';
  const tags = input.tags || {};
  const context = input.context || {};

  const fromFile = fromFilename(filePath);
  const fromTags = fromExistingTags(tags);
  const folder = hintFromPath(filePath);
  const folderHint = context.folderHint
    ? { album: context.folderHint, artist: '', reasons: ['folder hint'] }
    : null;
  const siblings = consensusFromSiblings(context.siblingTracks);

  let merged = mergeFields(fromTags, fromFile, folderHint, siblings);
  if (folder) {
    merged = mergeFields(merged, folder);
    if (folder.artist) {
      merged.artist = folder.artist;
      merged.artists = folder.artists || splitArtists(folder.artist);
      merged.reasons.push('library folder artist (priority)');
    }
    if (folder.album) {
      merged.album = folder.album;
      merged.reasons.push('library folder album (priority)');
    }
    if (folder.year && !merged.year) merged.year = folder.year;
  }
  const confidence = buildConfidence(merged.reasons, merged);

  return {
    fields: {
      title: merged.title,
      artist: merged.artist,
      artists: merged.artists,
      album: merged.album,
      genre: merged.genre,
      year: merged.year,
      trackNo: merged.trackNo,
    },
    confidence,
    sources: ['glyph-rules'],
    provider: 'glyph-rules',
    hints: merged.reasons.map((r) => ({ field: '*', message: r })),
  };
}
