/**
 * Glyph 2.2 analysis pipeline (renderer).
 */
import { analyze } from './index.js';
import { sanitizeGlyphFields } from './core/sanitize.js';
import { evaluateSuggestion } from './core/suggestion-confidence.js';
import { classifyWithHeuristics } from './core/ml-heuristic.js';
import { knnSuggest } from './core/knn.js';
import { titleEmbedding } from './core/title-vector.js';
import { splitArtists } from './utils/artists.js';
import { isLocalAgentAvailable, analyzeLocal } from './providers/local-agent.js';

function mergeFields(base, patch, reasons, source) {
  const fields = { ...base };
  const rs = [...(base._reasons || reasons || [])];
  for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
    const next = patch[key];
    if (!next) continue;
    const cur = String(fields[key] || '').trim();
    if (!cur || cur === 'Unknown Artist' || cur === 'Unknown Album' || cur === 'Unknown Title') {
      fields[key] = next;
      rs.push(`${source}: filled ${key}`);
    }
  }
  if (!fields.artists?.length && fields.artist) {
    fields.artists = splitArtists(fields.artist);
  }
  return { fields, reasons: rs };
}

function applyMlLayer(fields, track, reasons, sources) {
  const ml = classifyWithHeuristics({
    title: fields.title,
    artist: fields.artist,
    path: track.path,
    glyph: track.glyph || {},
    genre: fields.genre,
  });
  const patch = {};
  if (!fields.genre && ml.genre && (ml.fromText || ml.confidence >= 0.6)) {
    patch.genre = ml.genre;
  }
  if (patch.genre) sources.push('glyph-ml');
  return mergeFields(
    { ...fields, _reasons: reasons },
    patch,
    [...reasons, ...ml.reasons],
    'glyph-ml'
  );
}

function applyKnnLayer(fields, track, libraryRows, reasons, sources) {
  if (!libraryRows?.length) return { fields, reasons };
  const vec = titleEmbedding(fields.title, fields.artist);
  const { fields: knnFields, reasons: knnReasons } = knnSuggest(
    {
      trackId: track.id,
      title: fields.title,
      artist: fields.artist,
      bpm: track.glyph?.bpm,
      energy: track.glyph?.energy,
      vec,
    },
    libraryRows
  );
  if (!knnReasons.length) return { fields, reasons };
  sources.push('glyph-knn');
  const merged = mergeFields({ ...fields, _reasons: reasons }, knnFields, [...reasons, ...knnReasons], 'glyph-knn');
  return { fields: merged.fields, reasons: merged.reasons };
}

/**
 * Full Glyph 2.0 enrich after base analyze().
 */
export async function runGlyphPipeline(track, state, baseResult, { libraryRows = [], settings = {} }) {
  const sources = [...(baseResult.sources || [])];
  let reasons = [...(baseResult.confidence?.reasons || [])];
  let fields = sanitizeGlyphFields(track.path, track, { ...baseResult.fields });

  const mlMerged = applyMlLayer(fields, track, reasons, sources);
  fields = mlMerged.fields;
  reasons = mlMerged.reasons;

  if (settings.glyphUseKnn !== false && libraryRows.length) {
    const knnMerged = applyKnnLayer(fields, track, libraryRows, reasons, sources);
    fields = knnMerged.fields;
    reasons = knnMerged.reasons;
  }

  let confidence = evaluateSuggestion(track, fields, {
    score: baseResult.confidence?.score,
    reasons,
    sources,
  });

  return {
    fields,
    confidence,
    sources,
    provider: baseResult.provider || 'glyph-mi',
    hints: baseResult.hints,
  };
}

/**
 * Run full analysis: base + pipeline; Ollama only if low confidence.
 */
export async function analyzeTrackFull(track, state, options = {}) {
  const input = options.input;
  const settings = state.settings || {};
  const tryLocal = Boolean(settings.glyphTryLocal);
  const localOk = tryLocal ? await isLocalAgentAvailable() : false;

  let result = await analyze(input, {
    provider: 'mi',
    tryLocal: false,
    knowledgePacks: options.knowledgePacks || [],
  });

  result = await runGlyphPipeline(track, state, result, {
    libraryRows: options.libraryRows || [],
    settings,
  });

  const score = result.confidence?.score ?? 0;
  const useOllama = tryLocal && localOk && score < (settings.glyphOllamaThreshold ?? 42);

  if (useOllama) {
    const local = await analyzeLocal(input, options.localOptions || {});
    if (local?.fields) {
      const merged = { ...result.fields };
      for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
        if (!merged[key] && local.fields[key]) merged[key] = local.fields[key];
      }
      result = {
        ...result,
        fields: sanitizeGlyphFields(track.path, track, merged),
        provider: 'glyph-local',
        sources: [...new Set([...(result.sources || []), 'glyph-local'])],
      };
      result.confidence = evaluateSuggestion(track, result.fields, {
        score: result.confidence?.score,
        reasons: [...(result.confidence?.reasons || []), 'Ollama assist'],
        sources: result.sources,
      });
    }
  }

  return result;
}
