import { splitArtists } from './artists.js';

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fileBase(path) {
  const p = String(path || '').replace(/\\/g, '/');
  const name = p.slice(p.lastIndexOf('/') + 1);
  return norm(name.replace(/\.[^.]+$/, ''));
}

function tagFingerprint(tr) {
  const dur = Math.round(Number(tr.duration) || 0);
  const artist = norm(tr.artist);
  const title = norm(tr.title);
  const album = norm(tr.album);
  if (!title || (!artist && !album)) return '';
  return `${artist}|${title}|${album}|${dur}`;
}

function trackQualityScore(tr) {
  let s = 0;
  if (tr.title) s += 2;
  if (tr.artist && tr.artist !== 'Unknown Artist') s += 2;
  if (tr.album && tr.album !== 'Unknown Album') s += 2;
  if (tr.hasCover) s += 3;
  if (tr.genre) s += 1;
  if (tr.year) s += 1;
  const path = String(tr.path || '');
  if (path.includes('/music/') || path.includes('\\music\\')) s += 1;
  return s;
}

function pickKeeper(tracks) {
  return [...tracks].sort((a, b) => trackQualityScore(b) - trackQualityScore(a));
}

function groupKey(ids) {
  return [...ids].sort().join('\0');
}

/**
 * Find duplicate track groups in the library.
 * @returns {{ groups: Array<{ id: string, reason: string, reasonKey: string, tracks: object[], keepId: string, removeIds: string[] }>, duplicateTrackCount: number, groupCount: number }}
 */
export function findDuplicateGroups(tracks) {
  const byTag = new Map();
  const byName = new Map();

  for (const tr of tracks) {
    const fp = tagFingerprint(tr);
    if (fp && fp !== '|||0') {
      if (!byTag.has(fp)) byTag.set(fp, []);
      byTag.get(fp).push(tr);
    }
    const base = fileBase(tr.path);
    if (base.length >= 3) {
      if (!byName.has(base)) byName.set(base, []);
      byName.get(base).push(tr);
    }
  }

  const groups = [];
  const seen = new Set();

  const pushGroup = (reasonKey, reason, list) => {
    if (list.length < 2) return;
    const sorted = pickKeeper(list);
    const ids = sorted.map((t) => t.id);
    const key = groupKey(ids);
    if (seen.has(key)) return;
    seen.add(key);
    const keepId = sorted[0].id;
    groups.push({
      id: `dup-${groups.length + 1}`,
      reasonKey,
      reason,
      tracks: sorted,
      keepId,
      removeIds: sorted.slice(1).map((t) => t.id),
    });
  };

  for (const list of byTag.values()) {
    pushGroup('glyph.dupReasonTags', 'same metadata and duration', list);
  }
  for (const list of byName.values()) {
    const artists = new Set(list.map((t) => norm(t.artist)));
    if (artists.size > 2) continue;
    pushGroup('glyph.dupReasonFilename', 'same file name', list);
  }

  groups.sort((a, b) => b.removeIds.length - a.removeIds.length);

  const duplicateTrackCount = groups.reduce((n, g) => n + g.removeIds.length, 0);
  return { groups, duplicateTrackCount, groupCount: groups.length };
}

/** Merge spectral (fingerprint) groups without duplicating metadata groups. */
export function mergeDuplicateGroups(metaResult, spectralGroups = []) {
  const groups = [...(metaResult.groups || [])];
  const seen = new Set(groups.flatMap((g) => g.tracks.map((t) => t.id)));

  for (const g of spectralGroups) {
    const ids = g.tracks.map((t) => t.id);
    if (ids.some((id) => seen.has(id))) continue;
    ids.forEach((id) => seen.add(id));
    groups.push(g);
  }

  groups.sort((a, b) => b.removeIds.length - a.removeIds.length);
  const duplicateTrackCount = groups.reduce((n, g) => n + g.removeIds.length, 0);
  return { groups, duplicateTrackCount, groupCount: groups.length };
}

export function duplicateSummaryForTracks(tracks) {
  const { groupCount, duplicateTrackCount } = findDuplicateGroups(tracks);
  const attention = tracks.filter((t) => {
    if (!String(t.title || '').trim()) return true;
    const names = splitArtists(t.artist);
    if (!names.length || names.every((a) => a === 'Unknown Artist')) return true;
    if (!t.album || t.album === 'Unknown Album') return true;
    return false;
  }).length;
  return { groupCount, duplicateTrackCount, attention, total: tracks.length };
}
