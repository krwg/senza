import { analyzeRules } from './rules.js';
import { applyKnowledge } from '../knowledge.js';
import { buildConfidence } from '../core/confidence.js';
import { sanitizeGlyphFields } from '../core/sanitize.js';
import { splitArtists } from '../utils/artists.js';


export function analyzeMI(input, options = {}) {
  const base = analyzeRules(input);
  const packs = options.knowledgePacks || [];
  const merged = applyKnowledge(
    input.filePath || '',
    input.tags || {},
    base.fields,
    base.confidence?.reasons || [],
    packs
  );

  let fields = sanitizeGlyphFields(input.filePath || '', input.tags || {}, merged.fields);
  if (!fields.artists?.length && fields.artist) {
    fields.artists = splitArtists(fields.artist);
  }

  const confidence = buildConfidence(merged.reasons, fields);
  const sources = [...(base.sources || ['glyph-rules'])];
  if (merged.reasons.some((r) => r.includes('knowledge'))) {
    if (!sources.includes('glyph-knowledge')) sources.push('glyph-knowledge');
  }

  return {
    fields,
    confidence,
    sources,
    provider: 'glyph-mi',
    hints: merged.reasons.slice(0, 12).map((r) => ({ field: '*', message: r })),
  };
}
