/**
 * Batch Glyph — analyze library, preview, apply.
 */
import { runGlyphAnalysis } from './glyph-ui.js';
import { buildGlyphDiff } from './glyph-diff.js';
import { buildTagPatch, countPatchFields } from './glyph-tags.js';

export async function scanBatchCandidates(
  tracks,
  state,
  locale,
  api,
  { maxScore = 60, limit = 500, onProgress, cancelRef } = {}
) {
  const list = tracks.slice(0, limit);
  const results = [];
  const cancel = cancelRef || { cancelled: false };

  for (let i = 0; i < list.length; i += 1) {
    if (cancel.cancelled) break;
    onProgress?.({ phase: 'scan', done: i, total: list.length });
    const tr = list[i];
    try {
      const analysis = await runGlyphAnalysis(tr, state, locale, api);
      const conf = analysis?.result?.confidence;
      const fields = analysis?.result?.fields;
      if (!fields || conf?.noop) continue;
      if ((conf?.score ?? 0) > maxScore && (conf?.changes ?? 0) < 2) continue;
      const diff = buildGlyphDiff(tr, fields);
      if (!diff.hasChanges) continue;
      results.push({
        trackId: tr.id,
        track: tr,
        fields,
        confidence: conf,
        diff,
        patch: buildTagPatch(tr, fields, { aggressive: true }),
      });
    } catch (err) {
      console.warn('Glyph batch scan:', tr.id, err);
    }
  }

  return { results, scanned: list.length, cancelled: cancel.cancelled };
}

export async function applyBatchResults(results, api, { onProgress } = {}) {
  let applied = 0;
  let fieldsWritten = 0;
  for (let i = 0; i < results.length; i += 1) {
    const item = results[i];
    const tr = item.track;
    const patch = item.patch;
    const n = countPatchFields(patch);
    if (n < 1) continue;
    try {
      await api.writeTags({ trackId: tr.id, tags: { ...tr, ...patch } });
      if (api.glyphDbUpsert) {
        api.glyphDbUpsert({ ...tr, ...patch }).catch(() => {});
      }
      Object.assign(tr, patch);
      applied += 1;
      fieldsWritten += n;
    } catch (err) {
      console.warn('Glyph batch apply:', tr.id, err);
    }
    onProgress?.({ done: i + 1, total: results.length, applied });
  }
  return { applied, fieldsWritten };
}
