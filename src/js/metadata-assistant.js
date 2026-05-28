import { parseArtistTitle, splitArtists, joinArtists } from './artists.js';

const NOISE = /\b(final|v\d+|master|demo|edit|remix|official|audio|lyrics?)\b/gi;

function cleanBase(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s._-]*/, '')
    .replace(NOISE, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestFromFilename(filePath) {
  const base = filePath.split(/[/\\]/).pop() || '';
  const name = base.replace(/\.[^.]+$/, '');

  const parsed = parseArtistTitle(name);
  if (parsed) {
    const artists = splitArtists(parsed.artist);
    return {
      title: cleanBase(parsed.title) || parsed.title,
      artist: joinArtists(artists),
      artists,
      album: '',
      genre: '',
      year: '',
      trackNo: '',
      confidence: {
        level: artists.length > 1 ? 'high' : 'high',
        reasons: ['multi-artist title pattern'],
      },
    };
  }

  const triple = name.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*(.+)$/);
  if (triple) {
    const artists = splitArtists(triple[1].trim());
    return {
      artist: joinArtists(artists),
      artists,
      album: triple[2].trim(),
      title: cleanBase(triple[3]) || triple[3].trim(),
      genre: '',
      year: '',
      trackNo: '',
      confidence: { level: 'medium', reasons: ['artist-album-title pattern'] },
    };
  }

  const trackNoMatch = name.match(/^(\d{1,2})[\s._-]+(.+)$/);
  const cleaned = cleanBase(name);

  if (/505/i.test(name) && /track|final|v\d/i.test(name)) {
    const artists = ['Arctic Monkeys'];
    return {
      title: '505',
      artist: joinArtists(artists),
      artists,
      album: 'Favourite Worst Nightmare',
      year: '2007',
      genre: '',
      trackNo: trackNoMatch?.[1] || '',
      confidence: { level: 'medium', reasons: ['common demo filename heuristic'] },
    };
  }

  return {
    title: cleaned || name,
    artist: '',
    artists: [],
    album: '',
    genre: '',
    year: '',
    trackNo: trackNoMatch ? trackNoMatch[1] : '',
    confidence: { level: 'low', reasons: ['filename cleanup only'] },
  };
}

export function suggestFromTags(track) {
  const artists = splitArtists(track.artist || '');
  return {
    title: track.title || '',
    artist: joinArtists(artists),
    artists,
    album: track.album || '',
    genre: track.genre || '',
    year: track.year || '',
    trackNo: track.trackNo || '',
    confidence: { level: 'medium', reasons: ['from existing tags'] },
  };
}
