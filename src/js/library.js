export function groupBy(tracks, key) {
  const map = new Map();
  for (const track of tracks) {
    const k = track[key] || 'Unknown';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(track);
  }
  return map;
}

export function uniqueAlbums(tracks) {
  const map = new Map();
  for (const t of tracks) {
    const id = `${t.artist}::${t.album}`;
    if (!map.has(id)) map.set(id, { artist: t.artist, album: t.album, tracks: [] });
    map.get(id).tracks.push(t);
  }
  return [...map.values()];
}

export function uniqueArtists(tracks) {
  const map = new Map();
  for (const t of tracks) {
    if (!map.has(t.artist)) map.set(t.artist, []);
    map.get(t.artist).push(t);
  }
  return [...map.entries()].map(([name, list]) => ({ name, tracks: list }));
}

export function filterTracks(tracks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter((t) =>
    [t.title, t.artist, t.album, t.genre].some((f) => String(f || '').toLowerCase().includes(q))
  );
}

export function computeVault(tracks) {
  const total = tracks.length;
  if (!total) {
    return {
      total: 0,
      artists: 0,
      albums: 0,
      coverPct: 0,
      tagPct: 0,
      needsAttention: 0,
      score: 0,
    };
  }

  const artists = new Set(tracks.map((t) => t.artist)).size;
  const albums = new Set(tracks.map((t) => `${t.artist}::${t.album}`)).size;
  const withTags = tracks.filter((t) => t.artist !== 'Unknown Artist' && t.title).length;
  const withCover = tracks.filter((t) => t.hasCover).length;
  const needsAttention = tracks.filter(
    (t) => t.artist === 'Unknown Artist' || !t.album || t.album === 'Unknown Album'
  ).length;

  const coverPct = Math.round((withCover / total) * 100);
  const tagPct = Math.round((withTags / total) * 100);
  const score = Math.min(100, Math.round(tagPct * 0.5 + coverPct * 0.3 + (100 - (needsAttention / total) * 100) * 0.2));

  return { total, artists, albums, coverPct, tagPct, needsAttention, score };
}

export function formatDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function sortAlbumTracks(tracks) {
  return [...tracks].sort((a, b) => {
    const ta = Number(a.trackNo) || 0;
    const tb = Number(b.trackNo) || 0;
    if (ta && tb && ta !== tb) return ta - tb;
    return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' });
  });
}
