const MAX_HISTORY = 500;

export function logPlay(state, track) {
  if (!track?.id) return;
  if (!state.playHistory) state.playHistory = [];
  state.playHistory.unshift({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    playedAt: new Date().toISOString(),
  });
  if (state.playHistory.length > MAX_HISTORY) {
    state.playHistory.length = MAX_HISTORY;
  }
}

export function journalStats(history, tracksById, unknownArtist = 'Unknown Artist') {
  const entries = history || [];
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent = entries.filter((e) => new Date(e.playedAt).getTime() >= weekAgo);
  const artistCounts = new Map();

  for (const e of recent) {
    const tr = tracksById.get(e.trackId);
    const artist = tr?.artist || e.artist || unknownArtist;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
  }

  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, plays]) => ({ name, plays }));

  const capsule = findTimeCapsule(entries);

  return {
    totalPlays: entries.length,
    weekPlays: recent.length,
    topArtists,
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
