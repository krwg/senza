export function fingerprintSimilarity(a, b) {
  const aa = String(a || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n));
  const bb = String(b || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n));
  const n = Math.min(aa.length, bb.length);
  if (n < 12) return 0;
  let close = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(aa[i] - bb[i]) <= 3) close += 1;
  }
  return close / n;
}

function durationBucket(d) {
  return Math.round(Number(d) / 3) * 3;
}


export function findSpectralDuplicateGroups(tracks, fpByTrackId, { minSimilarity = 0.82 } = {}) {
  const buckets = new Map();
  for (const tr of tracks) {
    const fp = fpByTrackId.get(tr.id);
    if (!fp?.fingerprint || !fp.duration) continue;
    const key = durationBucket(fp.duration);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ track: tr, ...fp });
  }

  const groups = [];
  const used = new Set();

  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      if (used.has(list[i].track.id)) continue;
      const cluster = [list[i]];
      for (let j = i + 1; j < list.length; j += 1) {
        if (used.has(list[j].track.id)) continue;
        const durOk = Math.abs(list[i].duration - list[j].duration) <= 4;
        if (!durOk) continue;
        const sim = fingerprintSimilarity(list[i].fingerprint, list[j].fingerprint);
        if (sim >= minSimilarity) cluster.push(list[j]);
      }
      if (cluster.length < 2) continue;
      for (const c of cluster) used.add(c.track.id);
      const sorted = cluster.map((c) => c.track).sort((a, b) => {
        const score = (t) =>
          (t.hasCover ? 4 : 0) +
          (t.title ? 2 : 0) +
          (t.artist && t.artist !== 'Unknown Artist' ? 2 : 0) +
          (t.album && t.album !== 'Unknown Album' ? 2 : 0);
        return score(b) - score(a);
      });
      const keepId = sorted[0].id;
      groups.push({
        id: `spec-${groups.length + 1}`,
        reasonKey: 'glyph.dupReasonSpectral',
        reason: 'same audio fingerprint',
        tracks: sorted,
        keepId,
        removeIds: sorted.slice(1).map((t) => t.id),
        spectral: true,
      });
    }
  }
  return groups;
}


export async function loadFingerprintsForTracks(tracks, api, { limit = 120 } = {}) {
  const map = new Map();
  if (!api?.glyphFingerprint) return map;
  const slice = tracks.slice(0, limit);
  for (const tr of slice) {
    if (!tr.path) continue;
    try {
      const fp = await api.glyphFingerprint({ filePath: tr.path, duration: tr.duration });
      if (fp?.ok && fp.fingerprint) {
        map.set(tr.id, { duration: fp.duration || tr.duration, fingerprint: fp.fingerprint });
      }
    } catch {
      
    }
  }
  return map;
}
