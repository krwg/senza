import { buildConfidence } from '@glyph/core/confidence.js';
import { splitArtists } from './artists.js';

/** Merge online lookup into an existing Glyph result. */
export function mergeOnlineFields(base, onlineFields, provider, reasons = []) {
  const fields = { ...(base?.fields || {}) };
  const rs = [...(base?.confidence?.reasons || []), ...reasons];

  for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
    const cur = String(fields[key] || '').trim();
    const next = String(onlineFields[key] || '').trim();
    if (!cur && next) {
      fields[key] = next;
      rs.push(`${provider}: filled ${key}`);
    } else if (cur && next && cur.toLowerCase() !== next.toLowerCase() && key !== 'trackNo') {
      const weak = cur.length < 2 || /unknown/i.test(cur);
      if (weak) {
        fields[key] = next;
        rs.push(`${provider}: improved ${key}`);
      }
    }
  }

  if (!fields.artists?.length && fields.artist) {
    fields.artists = splitArtists(fields.artist);
  }

  const confidence = buildConfidence(rs, fields);
  const sources = [...new Set([...(base?.sources || []), provider])];

  return {
    ...base,
    fields,
    confidence,
    sources,
    provider: base?.provider || provider,
    online: { ...(base.online || {}), [provider]: true },
  };
}

export async function enrichWithOnline(api, track, baseResult, settings = {}) {
  if (!api) return baseResult;

  const score = baseResult?.confidence?.score ?? 0;
  const needsHelp = score < 68;
  const emptyTags =
    !String(track.title || '').trim() ||
    !String(track.artist || '').trim() ||
    !String(track.album || '').trim() ||
    track.album === 'Unknown Album' ||
    /unknown/i.test(track.artist || '');
  let merged = baseResult;

  const tryMb = settings.glyphUseMusicBrainz !== false && (needsHelp || emptyTags);
  if (tryMb && api.glyphMusicBrainzLookup) {
    try {
      const mb = await api.glyphMusicBrainzLookup({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      });
      if (mb?.ok && mb.fields) {
        merged = mergeOnlineFields(merged, mb.fields, 'musicbrainz', [
          mb.cached ? 'MusicBrainz (cache)' : 'MusicBrainz lookup',
        ]);
      }
    } catch {
      /* optional */
    }
  }

  const afterMb = merged?.confidence?.score ?? 0;
  const tryAc =
    settings.glyphUseAcoustid !== false &&
    afterMb < 58 &&
    api.glyphAcoustidLookup &&
    track.path;

  if (tryAc) {
    try {
      const ac = await api.glyphAcoustidLookup({
        filePath: track.path,
        duration: track.duration,
      });
      if (ac?.ok && ac.fields) {
        merged = mergeOnlineFields(merged, ac.fields, 'acoustid', [
          ac.cached ? 'AcoustID (cache)' : `AcoustID match${ac.score ? ` ${Math.round(ac.score * 100)}%` : ''}`,
        ]);
      }
    } catch {
      /* optional */
    }
  }

  return merged;
}
