/**
 * K-nearest neighbors over library feature rows (Glyph 2.0 memory).
 */
import { vectorSimilarity } from './title-vector.js';

function normArtist(a) {
  return String(a || '')
    .trim()
    .toLowerCase();
}

function fieldConsensus(neighbors, field) {
  const counts = new Map();
  for (const n of neighbors) {
    const v = String(n[field] || '').trim();
    if (!v || v === 'Unknown Artist' || v === 'Unknown Album') continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [k, c] of counts) {
    if (c > bestN) {
      bestN = c;
      best = k;
    }
  }
  return bestN >= 2 ? { value: best, count: bestN } : null;
}

/**
 * @param {object} query — { trackId, title, artist, album, genre, vec, bpm, energy }
 * @param {object[]} libraryRows — from SQLite index
 */
export function knnSuggest(query, libraryRows, { k = 8, minSimilarity = 0.35 } = {}) {
  const qid = query.trackId;
  const qVec = query.vec;
  const scored = [];

  for (const row of libraryRows) {
    if (row.track_id === qid) continue;
    const simTitle = qVec && row.title_vec ? vectorSimilarity(qVec, row.title_vec) : 0;
    const bpmDiff = Math.abs((query.bpm || 100) - (row.bpm || 100));
    const bpmSim = Math.max(0, 1 - bpmDiff / 80);
    const energyDiff = Math.abs((query.energy || 0.1) - (row.energy || 0.1));
    const enSim = Math.max(0, 1 - energyDiff / 0.25);
    const score = simTitle * 0.55 + bpmSim * 0.25 + enSim * 0.2;
    if (score < minSimilarity) continue;
    scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const neighbors = scored.slice(0, k).map((s) => s.row);
  if (neighbors.length < 3) {
    return { neighbors: [], fields: {}, reasons: [] };
  }

  const reasons = [`knn: ${neighbors.length} similar tracks in library`];
  const fields = {};
  const artistC = fieldConsensus(neighbors, 'artist_norm');
  const albumC = fieldConsensus(neighbors, 'album');
  const genreC = fieldConsensus(neighbors, 'genre');

  if (artistC) {
    fields.artist = artistC.value;
    reasons.push(`knn: artist consensus (${artistC.count}/${neighbors.length})`);
  }
  if (albumC) {
    fields.album = albumC.value;
    reasons.push(`knn: album consensus (${albumC.count}/${neighbors.length})`);
  }
  if (genreC && genreC.count >= Math.ceil(neighbors.length * 0.6)) {
    const g = genreC.value;
    const popBias = g === 'Pop' && genreC.count < neighbors.length * 0.85;
    if (!popBias) {
      fields.genre = g;
      reasons.push(`knn: genre consensus (${genreC.count}/${neighbors.length})`);
    }
  }

  return { neighbors, fields, reasons };
}

export function rowFromTrack(tr) {
  const vec = tr.title_vec;
  return {
    track_id: tr.id,
    title: tr.title,
    artist_norm: normArtist(tr.artist),
    album: tr.album,
    genre: tr.genre,
    bpm: tr.glyph?.bpm ?? tr.bpm ?? 0,
    energy: tr.glyph?.energy ?? 0.12,
    brightness: tr.glyph?.brightness ?? 1400,
    mood: tr.glyph?.mood ?? '',
    title_vec: vec,
  };
}
