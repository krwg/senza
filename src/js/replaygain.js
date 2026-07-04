export function replayGainDb(track, mode = 'track') {
  const rg = track?.glyph?.replayGain || track?.replayGain;
  if (!rg) return 0;
  const db = mode === 'album' ? rg.albumGainDb : rg.trackGainDb;
  if (db == null || !Number.isFinite(Number(db))) return 0;
  return Number(db);
}

export function gainToLinear(db) {
  if (!db) return 1;
  return Math.pow(10, db / 20);
}

export function effectiveVolume(baseVolume, track, settings = {}) {
  if (!settings.replayGainEnabled) return baseVolume;
  const mode = settings.replayGainMode === 'album' ? 'album' : 'track';
  const db = replayGainDb(track, mode);
  const linear = gainToLinear(db);
  const preamp = Number(settings.replayGainPreamp) || 0;
  const preampLinear = gainToLinear(preamp);
  return Math.max(0, Math.min(1, baseVolume * linear * preampLinear));
}
