import { GLYPH_EVENTS, pickTagFields } from '@glyph/core/logger.js';
import { pickTags } from './glyph-learn.js';

export { GLYPH_EVENTS };

function loggingEnabled(settings) {
  return settings?.glyphLogEnabled !== false;
}

export function buildGlyphContext(track, state, extra = {}) {
  const siblings = (state?.tracks || [])
    .filter(
      (tr) =>
        tr.id !== track?.id &&
        tr.album === track?.album &&
        tr.artist === track?.artist
    )
    .slice(0, 8)
    .map((tr) => pickTags(tr));

  return {
    path: track?.path ?? null,
    hourLocal: new Date().getHours(),
    siblingTracks: siblings,
    librarySize: state?.tracks?.length ?? 0,
    ...extra,
  };
}


export async function logGlyphTelemetry(api, settings, track, event, opts = {}) {
  if (!api?.glyphLog) return null;
  if (!loggingEnabled(settings)) return null;

  const before = pickTagFields(opts.before ?? track);
  const suggested = pickTagFields(opts.suggested ?? opts.suggestion?.fields);
  const after = pickTagFields(opts.after ?? opts.outcome?.fields);

  try {
    return await api.glyphLog({
      project: 'senza',
      agent: 'music',
      event,
      track: track ? { id: track.id, path: track.path } : { id: opts.trackId },
      input: { tags: before },
      suggestion: {
        fields: suggested,
        provider: opts.glyph?.provider ?? opts.provider ?? null,
      },
      outcome: { fields: after },
      confidence: opts.glyph?.confidence ?? opts.confidence ?? null,
      sources: opts.glyph?.sources ?? opts.sources ?? [],
      accepted: opts.accepted ?? null,
      edited: opts.edited ?? null,
      context: opts.context ?? null,
    });
  } catch (err) {
    console.warn('Glyph log:', err);
    return null;
  }
}

export async function logGlyphSuggest(api, settings, track, analysis, state) {
  const result = analysis?.result;
  if (!result) return null;
  const fields = pickTagFields(result.fields);
  const noop = result.confidence?.noop;
  const event = noop ? GLYPH_EVENTS.NOOP : GLYPH_EVENTS.SUGGEST;

  return logGlyphTelemetry(api, settings, track, event, {
    before: track,
    suggested: fields,
    after: track,
    glyph: {
      provider: result.provider,
      confidence: result.confidence,
      sources: result.sources,
    },
    confidence: result.confidence,
    sources: result.sources,
    accepted: noop ? null : null,
    context: buildGlyphContext(track, state),
  });
}

export async function logGlyphApply(api, settings, track, { before, suggested, after, glyph, accepted, edited }) {
  const event = GLYPH_EVENTS.APPLY;
  return logGlyphTelemetry(api, settings, track, event, {
    before,
    suggested,
    after,
    glyph,
    accepted: accepted !== false,
    edited,
    context: buildGlyphContext(track, { tracks: [track] }),
  });
}

export async function logGlyphReject(api, settings, track, { before, suggested, glyph, state }) {
  return logGlyphTelemetry(api, settings, track, GLYPH_EVENTS.REJECT, {
    before,
    suggested,
    after: before,
    glyph,
    accepted: false,
    context: buildGlyphContext(track, state),
  });
}

export async function logGlyphAuto(api, settings, track, { before, suggested, after, glyph, accepted }) {
  return logGlyphTelemetry(api, settings, track, GLYPH_EVENTS.AUTO, {
    before,
    suggested,
    after,
    glyph,
    accepted,
    context: buildGlyphContext(track, { tracks: [track] }),
  });
}
