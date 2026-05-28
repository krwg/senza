/**
 * Glyph 2.0 local ML layer (no ONNX file required).
 * Uses audio profile + text features; ONNX can replace later via same interface.
 */

const GENRES = [
  'Hip-Hop',
  'Pop',
  'Rock',
  'Electronic',
  'R&B',
  'Jazz',
  'Classical',
  'Metal',
  'Country',
  'Soundtrack',
  'Latin',
  'Reggae',
  'Blues',
  'Folk',
  'Ambient',
  'Indie',
  'Dance',
  'Soul',
  'Funk',
  'Other',
];

const MOODS = ['drive', 'upbeat', 'focus', 'chill'];

function norm(s) {
  return String(s || '').toLowerCase();
}

function genreFromText(title, artist, path) {
  const hay = norm(`${title} ${artist} ${path}`);
  if (/type\s+beat|trap|drill|hip\s*hop|rap\b/.test(hay)) return 'Hip-Hop';
  if (/soundtrack|ost|саундтрек|score/.test(hay)) return 'Soundtrack';
  if (/techno|house|edm|trance|dubstep|electro/.test(hay)) return 'Electronic';
  if (/metal|punk|hardcore/.test(hay)) return 'Metal';
  if (/jazz|swing/.test(hay)) return 'Jazz';
  if (/classical|piano\s+sonata|symphony/.test(hay)) return 'Classical';
  if (/country|folk|acoustic/.test(hay)) return 'Country';
  if (/reggae|dancehall/.test(hay)) return 'Reggae';
  if (/\bpop\b|radio\s+edit|dance\s+pop|synth\s*pop/.test(hay)) return 'Pop';
  if (/\brock\b|indie\s*rock|alt\.?\s*rock/.test(hay)) return 'Rock';
  if (/r&b|rnb|soul/.test(hay)) return 'R&B';
  return '';
}

export function classifyWithHeuristics({ title, artist, path, glyph = {}, genre: existingGenre }) {
  const bpm = Number(glyph.bpm) || 110;
  const energy = Number(glyph.energy) || 0.12;
  const reasons = [];

  const fromText = genreFromText(title, artist, path);
  let genre = existingGenre || fromText;
  const inferred = !genre;
  if (!genre) {
    if (bpm >= 128 && energy > 0.18) genre = 'Dance';
    else if (energy < 0.09 && bpm < 105) genre = 'Ambient';
    /* no default Pop — leave empty unless text/BPM strongly hints */
  }
  if (inferred && genre) reasons.push('ml-heuristic: genre inferred');
  if (fromText) reasons.push('ml-heuristic: genre from text/path');

  let mood = glyph.mood || 'chill';
  if (energy > 0.16 && bpm >= 115) mood = 'drive';
  else if (energy > 0.15 && bpm < 115) mood = 'upbeat';
  else if (energy <= 0.15 && bpm >= 95) mood = 'focus';

  const needsTags =
    !title ||
    !artist ||
    artist === 'Unknown Artist' ||
    !existingGenre;

  const qualityScore = needsTags ? 0.35 : 0.85;

  return {
    genre: genre && GENRES.includes(genre) ? genre : genre ? 'Other' : '',
    mood,
    needsTags,
    qualityScore,
    confidence: fromText ? 0.72 : inferred && genre ? 0.58 : 0.4,
    reasons,
    provider: 'glyph-ml',
    fromText: Boolean(fromText),
  };
}
