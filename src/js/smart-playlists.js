/** Smart playlist rule evaluation (local, no cloud). */

const RULE_TYPES = ['genre', 'year', 'unplayedDays', 'favorite', 'recent'];

export { RULE_TYPES };

function daysSince(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 86400000;
}

function lastPlayedDays(trackId, playHistory) {
  let latest = null;
  for (const e of playHistory || []) {
    if (e.trackId !== trackId) continue;
    if (!latest || e.at > latest) latest = e.at;
  }
  return latest ? daysSince(latest) : Infinity;
}

/**
 * @param {object} rule { type, value }
 * @param {object} ctx { playHistory, favorites, now }
 */
function trackMatchesRule(tr, rule, ctx) {
  const type = rule?.type;
  const val = rule?.value;
  if (type === 'genre') {
    return String(tr.genre || '').toLowerCase().includes(String(val || '').toLowerCase());
  }
  if (type === 'year') {
    return String(tr.year || '') === String(val || '');
  }
  if (type === 'unplayedDays') {
    const minDays = Number(val) || 30;
    return lastPlayedDays(tr.id, ctx.playHistory) >= minDays;
  }
  if (type === 'favorite') {
    return ctx.favorites?.has?.(tr.id);
  }
  if (type === 'recent') {
    const maxDays = Number(val) || 14;
    return tr.addedAt && daysSince(tr.addedAt) <= maxDays;
  }
  return false;
}

/**
 * Smart playlist: all rules must match (AND).
 */
export function evaluateSmartPlaylist(allTracks, playlist, ctx) {
  const rules = playlist?.rules || [];
  if (!rules.length) return [];
  return allTracks.filter((tr) => rules.every((r) => trackMatchesRule(tr, r, ctx)));
}

export function defaultSmartPlaylists(locale) {
  const ru = locale === 'ru';
  return [
    {
      id: 'smart-unplayed',
      name: ru ? 'Давно не слушал' : 'Not played lately',
      smart: true,
      rules: [{ type: 'unplayedDays', value: 30 }],
    },
    {
      id: 'smart-favorites',
      name: ru ? 'Избранное' : 'Favorites',
      smart: true,
      rules: [{ type: 'favorite', value: true }],
    },
    {
      id: 'smart-recent',
      name: ru ? 'Недавно добавлено' : 'Recently added',
      smart: true,
      rules: [{ type: 'recent', value: 14 }],
    },
  ];
}
