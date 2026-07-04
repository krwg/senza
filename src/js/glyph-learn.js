export function pickTags(obj) {
  if (!obj) return {};
  return {
    title: String(obj.title ?? '').trim(),
    artist: String(obj.artist ?? '').trim(),
    album: String(obj.album ?? '').trim(),
    genre: String(obj.genre ?? '').trim(),
    year: obj.year != null && obj.year !== '' ? String(obj.year) : '',
    trackNo: obj.trackNo != null && obj.trackNo !== '' ? String(obj.trackNo) : '',
  };
}

export function pickTagsFromForm() {
  return pickTags({
    title: document.getElementById('tagTitle')?.value,
    artist: document.getElementById('tagArtist')?.value,
    album: document.getElementById('tagAlbum')?.value,
    genre: document.getElementById('tagGenre')?.value,
    year: document.getElementById('tagYear')?.value,
    trackNo: document.getElementById('tagTrackNo')?.value,
  });
}

export function tagsMatch(a, b) {
  const A = pickTags(a);
  const B = pickTags(b);
  return ['title', 'artist', 'album', 'genre', 'year', 'trackNo'].every((k) => A[k] === B[k]);
}

export function glyphMetaFromAnalysis(analysis) {
  if (!analysis?.result) return null;
  const { result } = analysis;
  return {
    provider: result.provider,
    confidence: result.confidence,
    fields: pickTags(result.fields),
  };
}


export async function logGlyphEvent(api, settings, trackId, event, data) {
  const track = data.track || { id: trackId, path: data.path || '' };

  if (api?.glyphLog && settings?.glyphLogEnabled !== false) {
    const { logGlyphTelemetry, GLYPH_EVENTS } = await import(
      './glyph-telemetry.js'
    );
    const legacyToSql = {
      glyph_apply_all: GLYPH_EVENTS.APPLY,
      glyph_apply_field: GLYPH_EVENTS.APPLY,
      tag_save: GLYPH_EVENTS.APPLY_EDITED,
      glyph_suggest: GLYPH_EVENTS.SUGGEST,
      glyph_reject: GLYPH_EVENTS.REJECT,
    };
    const sqlEvent = legacyToSql[event] || event;
    const accepted =
      data.accepted === true ? true : data.accepted === false ? false : null;
    await logGlyphTelemetry(api, settings, track, sqlEvent, {
      before: data.before,
      suggested: data.suggested,
      after: data.after,
      glyph: data.glyph,
      accepted,
      edited: data.edited ?? (data.after && data.suggested && !tagsMatch(data.suggested, data.after)),
      context: data.context,
    });
  }

  if (settings?.glyphLearnEnabled === false) return;
  if (!api?.glyphLearnLog) return;
  try {
    await api.glyphLearnLog({
      trackId,
      event,
      contributorId: settings.glyphContributorId || '',
      ...data,
    });
  } catch {
    
  }
}
