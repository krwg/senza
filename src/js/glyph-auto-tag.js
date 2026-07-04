import { runGlyphAnalysis } from './glyph-ui.js';
import { trackNeedsAttention } from './library.js';
import { buildTagPatch, countPatchFields } from './glyph-tags.js';
import { sanitizeGlyphFields } from '@glyph/core/sanitize.js';
import { pickTags, glyphMetaFromAnalysis } from './glyph-learn.js';
import { logGlyphAuto, logGlyphTelemetry, GLYPH_EVENTS } from './glyph-telemetry.js';


export async function autoTagTracks(tracks, state, locale, api, options = {}) {
  const minScore = options.minScore ?? 32;
  const minFields = options.minFields ?? 1;
  const maxTracks = options.maxTracks ?? 200;
  const onlyWeak = options.onlyWeak === true;
  const aggressive = options.aggressive !== false;

  if (!tracks?.length || !api?.writeTags) {
    return { applied: 0, skipped: 0, checked: 0, fieldsWritten: 0 };
  }

  let list = onlyWeak ? tracks.filter((t) => trackNeedsAttention(t)) : [...tracks];
  if (!list.length) list = tracks;
  list = list.slice(0, maxTracks);

  let applied = 0;
  let skipped = 0;
  let fieldsWritten = 0;

  for (const tr of list) {
    try {
      const analysis = await runGlyphAnalysis(tr, state, locale, api);
      let fields = analysis?.result?.fields;
      if (!fields) {
        skipped += 1;
        continue;
      }

      fields = sanitizeGlyphFields(tr.path, tr, fields);
      const conf = analysis?.result?.confidence;

      const patch = buildTagPatch(tr, fields, { aggressive });
      const nFields = countPatchFields(patch);
      if (nFields < minFields) {
        skipped += 1;
        continue;
      }
      if (conf?.noop && !aggressive) {
        await logGlyphTelemetry(api, state.settings, tr, GLYPH_EVENTS.NOOP, {
          before: pickTags(tr),
          suggested: pickTags(fields),
          after: pickTags(tr),
          glyph: glyphMetaFromAnalysis(analysis),
          confidence: conf,
          sources: analysis?.result?.sources,
          context: { source: 'auto-tag', reason: 'noop' },
        });
        skipped += 1;
        continue;
      }
      if ((conf?.score ?? 0) < minScore && nFields < 2) {
        skipped += 1;
        continue;
      }

      const beforeTags = pickTags(tr);
      await api.writeTags({
        trackId: tr.id,
        tags: { ...tr, ...patch },
      });
      if (api.glyphDbUpsert) {
        api.glyphDbUpsert({ ...tr, ...patch }).catch(() => {});
      }
      await logGlyphAuto(api, state.settings, tr, {
        before: beforeTags,
        suggested: pickTags(fields),
        after: pickTags({ ...tr, ...patch }),
        glyph: glyphMetaFromAnalysis(analysis),
        accepted: true,
      });
      applied += 1;
      fieldsWritten += nFields;
      Object.assign(tr, patch);
    } catch (err) {
      console.warn('Glyph auto-tag:', tr.id, err);
      skipped += 1;
    }
  }

  return { applied, skipped, checked: list.length, fieldsWritten };
}
