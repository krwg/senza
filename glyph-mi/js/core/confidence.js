export function buildConfidence(reasons, fields) {
  let score = 20;
  const hasArtist = Boolean(fields.artist);
  const hasTitle = Boolean(fields.title);
  const hasAlbum = Boolean(fields.album);

  if (hasTitle) score += 25;
  if (hasArtist) score += 30;
  if (hasAlbum) score += 15;
  if (fields.year) score += 5;
  if (fields.trackNo) score += 5;

  const highSignals = reasons.filter((r) =>
    /pattern|folder|consensus|tags|multi-artist/i.test(r)
  ).length;
  score += Math.min(20, highSignals * 6);

  if (reasons.some((r) => /cleanup only|low/i.test(r))) score = Math.min(score, 35);

  score = Math.max(0, Math.min(100, score));

  let level = 'low';
  if (score >= 72) level = 'high';
  else if (score >= 48) level = 'medium';

  return { level, score, reasons: [...reasons] };
}
