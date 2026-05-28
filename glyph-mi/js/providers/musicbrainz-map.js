/** Map MusicBrainz API JSON to Glyph tag fields. */

function pickYear(dateStr) {
  const m = String(dateStr || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

function artistFromCredit(credits) {
  if (!credits?.length) return '';
  return credits
    .map((c) => c.name || c.artist?.name || '')
    .filter(Boolean)
    .join(', ');
}

export function mapMusicBrainzRecording(rec) {
  if (!rec) return null;
  const artist = artistFromCredit(rec['artist-credit']);
  const releases = rec.releases || [];
  const rel = releases[0];
  return {
    title: rec.title || '',
    artist,
    album: rel?.title || '',
    year: pickYear(rel?.date),
    genre: '',
    trackNo: '',
    mbRecordingId: rec.id || '',
  };
}

export function scoreMusicBrainzMatch(rec, { artist, title, duration }) {
  if (!rec) return 0;
  let score = 0;
  const gotTitle = String(rec.title || '').toLowerCase();
  const wantTitle = String(title || '').toLowerCase();
  const gotArtist = artistFromCredit(rec['artist-credit']).toLowerCase();
  const wantArtist = String(artist || '').toLowerCase();

  if (wantTitle && gotTitle === wantTitle) score += 40;
  else if (wantTitle && gotTitle.includes(wantTitle)) score += 25;

  if (wantArtist && gotArtist.includes(wantArtist.split(',')[0].trim())) score += 35;

  const len = rec.length;
  const durMs = Math.round((Number(duration) || 0) * 1000);
  if (len && durMs && Math.abs(len - durMs) < 3000) score += 20;

  return score;
}

export function pickBestRecording(recordings, query) {
  if (!recordings?.length) return null;
  let best = null;
  let bestScore = 0;
  for (const rec of recordings) {
    const s = scoreMusicBrainzMatch(rec, query);
    if (s > bestScore) {
      bestScore = s;
      best = rec;
    }
  }
  return bestScore >= 45 ? mapMusicBrainzRecording(best) : null;
}
