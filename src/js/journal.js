import { splitArtists } from './artists.js';

const MAX_HISTORY = 500;

export function formatMinutes(ms, locale = 'en') {
  const totalMin = Math.max(0, Math.floor((ms || 0) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) {
    return locale === 'ru' ? `${h} ч ${m} мин` : `${h} h ${m} min`;
  }
  return locale === 'ru' ? `${m} мин` : `${m} min`;
}

export function logPlay(state, track) {
  if (!track?.id) return;
  if (!state.playHistory) state.playHistory = [];
  const durationSec = Number(track.duration) > 0 ? Number(track.duration) : 0;
  state.playHistory.unshift({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    playedAt: new Date().toISOString(),
    durationSec,
  });
  if (state.playHistory.length > MAX_HISTORY) {
    state.playHistory.length = MAX_HISTORY;
  }
}

export function journalStats(history, tracksById, unknownArtist = 'Unknown Artist', usageMs = 0) {
  const entries = history || [];
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent = entries.filter((e) => new Date(e.playedAt).getTime() >= weekAgo);
  const artistCounts = new Map();
  const trackCounts = new Map();
  let listeningMs = 0;

  for (const e of entries) {
    const tr = tracksById.get(e.trackId);
    const sec = Number(e.durationSec) > 0 ? Number(e.durationSec) : Number(tr?.duration) || 0;
    listeningMs += sec * 1000;
  }

  for (const e of recent) {
    const tr = tracksById.get(e.trackId);
    const raw = tr?.artist || e.artist || unknownArtist;
    const names = splitArtists(raw);
    const list = names.length ? names : [raw];
    for (const name of list) {
      artistCounts.set(name, (artistCounts.get(name) || 0) + 1);
    }
    const title = tr?.title || e.title || '—';
    const artist = tr?.artist || e.artist || unknownArtist;
    const key = e.trackId || `${title}\0${artist}`;
    const prev = trackCounts.get(key);
    if (prev) prev.plays += 1;
    else trackCounts.set(key, { trackId: e.trackId, title, artist, plays: 1 });
  }

  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, plays]) => ({ name, plays }));

  const topTracks = [...trackCounts.values()]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const capsule = findTimeCapsule(entries);

  return {
    totalPlays: entries.length,
    weekPlays: recent.length,
    usageMs: usageMs || 0,
    listeningMs,
    topArtists,
    topTracks,
    recent: entries.slice(0, 40),
    timeCapsule: capsule,
  };
}

/** Music Time Capsule — entry from ~1 year ago (±7 days). */
export function findTimeCapsule(history) {
  if (!history?.length) return null;
  const target = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  let best = null;
  let bestDelta = Infinity;
  for (const e of history) {
    const t = new Date(e.playedAt).getTime();
    const delta = Math.abs(t - target);
    if (delta < windowMs && delta < bestDelta) {
      bestDelta = delta;
      best = e;
    }
  }
  return best;
}
