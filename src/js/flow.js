import { trackWithInferredAlbum } from './glyph-album.js';
import { splitArtists } from './artists.js';

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';

function metadataQuality(tr) {
  let q = 0;
  if (tr.title) q += 12;
  if (tr.artist && tr.artist !== UNKNOWN_ARTIST) q += 14;
  if (tr.album && tr.album !== UNKNOWN_ALBUM) q += 10;
  if (tr.genre) q += 4;
  if (tr.year) q += 3;
  if (tr.hasCover) q += 8;
  const path = String(tr.path || '');
  if (/\/music\//i.test(path) || /\\music\\/i.test(path)) q += 5;
  return q;
}

const MODES = ['blend', 'favorites', 'rare', 'discover'];

function playCounts(history) {
  const map = new Map();
  for (const e of history || []) {
    map.set(e.trackId, (map.get(e.trackId) || 0) + 1);
  }
  return map;
}

function scoreTrack(tr, { plays, mode, recentIds, allTracks }) {
  const enriched = trackWithInferredAlbum(tr, allTracks);
  let score = 8 + metadataQuality(enriched) * 0.55;
  const p = plays.get(tr.id) || 0;
  const artistParts = splitArtists(enriched.artist).filter((a) => a && a !== UNKNOWN_ARTIST);

  if (mode === 'favorites') {
    score += Math.min(42, p * 9);
    if (p === 0) score -= 12;
  }
  if (mode === 'rare') {
    score += Math.max(6, 32 - p * 7);
    if (p > 8) score -= 15;
  }
  if (mode === 'discover') {
    if (p === 0) score += 34;
    else score += Math.max(0, 14 - p * 2.5);
    if (metadataQuality(enriched) < 28) score += 6;
  }

  const g = tr.glyph;
  if (g?.mood === 'drive' && (mode === 'favorites' || mode === 'blend')) score += 8;
  if (g?.mood === 'chill' && mode === 'rare') score += 6;
  if (g?.mood === 'focus' && mode === 'discover') score += 5;
  if (mode === 'blend') {
    score += Math.min(22, p * 3.2) + (p === 0 ? 12 : 0);
    if (artistParts.length > 1) score += 4;
  }

  if (recentIds.has(tr.id)) score -= 85;
  score += Math.random() * 10;
  return Math.max(1, score);
}

function pickWeighted(pool, n) {
  const out = [];
  const left = [...pool];
  while (out.length < n && left.length) {
    const total = left.reduce((s, x) => s + Math.max(1, x.score), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < left.length; i += 1) {
      r -= Math.max(1, left[i].score);
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(left[idx].track);
    left.splice(idx, 1);
  }
  return out;
}

/**
 * Build a Flow wave (no repeats within session).
 * @returns {{ tracks: object[], mode: string }}
 */
export function buildFlowWave(allTracks, playHistory, {
  mode = 'blend',
  sessionPlayed = new Set(),
  size = 28,
} = {}) {
  const safeMode = MODES.includes(mode) ? mode : 'blend';
  const plays = playCounts(playHistory);
  const recentIds = new Set([...sessionPlayed].slice(-120));

  const pool = allTracks
    .filter((tr) => tr.path && !sessionPlayed.has(tr.id))
    .map((tr) => ({
      track: trackWithInferredAlbum(tr, allTracks),
      score: scoreTrack(tr, { plays, mode: safeMode, recentIds, allTracks: allTracks }),
    }));

  if (!pool.length) {
    return { tracks: [], mode: safeMode, exhausted: true };
  }

  const wave = pickWeighted(pool, Math.min(size, pool.length));
  return { tracks: wave, mode: safeMode, exhausted: false };
}

export function flowModeLabel(mode, t, locale) {
  return t(`flow.mode.${mode}`, locale);
}

export { MODES as FLOW_MODES };
