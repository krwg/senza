import { splitArtists, artistSlug, trackIncludesArtist } from './artists.js';

export { trackIncludesArtist };

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
    const names = splitArtists(t.artist);
    const list = names.length ? names : [t.artist || 'Unknown Artist'];
    for (const name of list) {
      const id = artistSlug(name);
      if (!map.has(id)) map.set(id, { id, name, tracks: [] });
      const entry = map.get(id);
      if (!entry.tracks.some((tr) => tr.id === t.id)) entry.tracks.push(t);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function filterTracks(tracks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter((t) => {
    const artistHay = splitArtists(t.artist).join(' ');
    return [t.title, artistHay, t.artist, t.album, t.genre].some((f) =>
      String(f || '').toLowerCase().includes(q)
    );
  });
}

export function trackNeedsAttention(t, unknownArtist = 'Unknown Artist') {
  if (!String(t.title || '').trim()) return true;
  if (!t.album || t.album === 'Unknown Album') return true;
  const names = splitArtists(t.artist);
  if (!names.length) return true;
  return names.every((a) => a === unknownArtist);
}

export function tracksNeedingAttention(tracks, unknownArtist = 'Unknown Artist') {
  return tracks.filter((t) => trackNeedsAttention(t, unknownArtist));
}

export function tracksMissingCovers(tracks) {
  return tracks.filter((t) => !t.hasCover);
}

export function pickAlbumCoverTrack(albumTracks) {
  if (!albumTracks?.length) return null;
  return albumTracks.find((t) => t.hasCover) || albumTracks[0];
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
      missingCovers: 0,
      score: 0,
      attentionTracks: [],
      noCoverTracks: [],
    };
  }

  const artistNames = new Set();
  for (const t of tracks) {
    for (const a of splitArtists(t.artist)) artistNames.add(a.toLowerCase());
  }
  const artists = artistNames.size;
  const albums = new Set(tracks.map((t) => `${t.artist}::${t.album}`)).size;
  const withTags = tracks.filter((t) => t.artist !== 'Unknown Artist' && t.title).length;
  const withCover = tracks.filter((t) => t.hasCover).length;
  const attentionTracks = tracksNeedingAttention(tracks);
  const noCoverTracks = tracksMissingCovers(tracks);

  const coverPct = Math.round((withCover / total) * 100);
  const tagPct = Math.round((withTags / total) * 100);
  const needsAttention = attentionTracks.length;
  const missingCovers = noCoverTracks.length;
  const score = Math.min(
    100,
    Math.round(tagPct * 0.5 + coverPct * 0.3 + (100 - (needsAttention / total) * 100) * 0.2)
  );

  return {
    total,
    artists,
    albums,
    coverPct,
    tagPct,
    needsAttention,
    missingCovers,
    score,
    attentionTracks,
    noCoverTracks,
  };
}

export function formatDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function sortAlbumTracks(tracks) {
  return sortTracks(tracks, 'trackNo', 'asc');
}

export const TRACK_SORT_KEYS = ['title', 'artist', 'album', 'duration', 'added', 'trackNo'];

function cmp(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base', numeric: true });
}

function num(a) {
  const n = Number(a);
  return Number.isFinite(n) ? n : 0;
}

export function sortTracks(tracks, key = 'title', dir = 'asc') {
  const mul = dir === 'desc' ? -1 : 1;
  return [...tracks].sort((a, b) => {
    let r = 0;
    switch (key) {
      case 'artist':
        r = cmp(a.artist, b.artist);
        break;
      case 'album':
        r = cmp(a.album, b.album) || cmp(a.artist, b.artist);
        break;
      case 'duration':
        r = num(a.duration) - num(b.duration);
        break;
      case 'added':
        r = cmp(a.addedAt, b.addedAt);
        break;
      case 'trackNo':
        r = num(a.trackNo) - num(b.trackNo);
        if (!r) r = cmp(a.title, b.title);
        break;
      case 'title':
      default:
        r = cmp(a.title, b.title);
        break;
    }
    return r * mul;
  });
}

export function sortAlbumEntries(albums, key = 'album', dir = 'asc') {
  const mul = dir === 'desc' ? -1 : 1;
  return [...albums].sort((a, b) => {
    let r = 0;
    if (key === 'artist') r = cmp(a.artist, b.artist) || cmp(a.album, b.album);
    else if (key === 'tracks') r = a.tracks.length - b.tracks.length;
    else r = cmp(a.album, b.album) || cmp(a.artist, b.artist);
    return r * mul;
  });
}

export function sortArtistEntries(artists, key = 'name', dir = 'asc') {
  const mul = dir === 'desc' ? -1 : 1;
  return [...artists].sort((a, b) => {
    let r = 0;
    if (key === 'tracks') r = a.tracks.length - b.tracks.length;
    else r = cmp(a.name, b.name);
    return r * mul;
  });
}
