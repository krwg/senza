function norm(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function isWeakValue(v, key) {
  const n = norm(v);
  if (!n) return true;
  if (key === 'artist' && (n === 'unknown artist' || n === 'unknown')) return true;
  if (key === 'album' && (n === 'unknown album' || n === 'unknown')) return true;
  if (key === 'title' && (n === 'unknown title' || n === 'untitled')) return true;
  return false;
}

/**
 * Confidence for applying suggestions vs current tags (per-track, dynamic).
 */
export function evaluateSuggestion(currentTags = {}, suggestedFields = {}, base = {}) {
  const reasons = [...(base.reasons || [])];
  const sources = base.sources || [];
  const fields = ['title', 'artist', 'album', 'genre', 'year', 'trackNo'];
  let changes = 0;
  let weak = 0;
  const changedKeys = [];

  for (const key of fields) {
    const cur = norm(currentTags[key]);
    const sug = norm(suggestedFields[key]);
    if (isWeakValue(currentTags[key], key)) weak += 1;
    if (!sug) continue;
    if (cur !== sug) {
      changes += 1;
      changedKeys.push(key);
      if (!cur) reasons.push(`fill ${key}`);
      else reasons.push(`update ${key}`);
    }
  }

  let score = Number(base.score) || 35;
  if (changes === 0) {
    score = Math.min(score, 30);
    reasons.push('tags already match suggestion');
  } else {
    score = Math.min(100, Math.max(score, 42) + Math.min(22, changes * 6));
  }
  if (weak >= 1 && changes > 0) score = Math.min(100, score + 12);
  if (weak >= 2) score = Math.min(100, score + 8);

  if (sources.includes('musicbrainz')) score = Math.min(100, score + 10);
  if (sources.includes('acoustid')) score = Math.min(100, score + 8);
  if (sources.includes('glyph-knowledge')) score = Math.min(100, score + 4);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level = 'low';
  if (score >= 72) level = 'high';
  else if (score >= 48) level = 'medium';

  return {
    level,
    score,
    reasons: [...new Set(reasons)].slice(0, 14),
    changes,
    changedKeys,
    weak,
    noop: changes === 0,
  };
}
