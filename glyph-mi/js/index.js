import { analyzeRules } from './providers/rules.js';
import { analyzeMI } from './providers/mi.js';
import { analyzeLocal, isLocalAgentAvailable } from './providers/local-agent.js';

export { splitArtists, joinArtists, parseArtistTitle } from './utils/artists.js';
export { analyzeRules, analyzeMI, analyzeLocal, isLocalAgentAvailable };
export { applyKnowledge } from './knowledge.js';

/**
 * Analyze one track and suggest metadata.
 * @param {object} input — { filePath, tags?, context? }
 * @param {object} options — { tryLocal?, provider?: 'rules'|'local', ollamaUrl?, model? }
 */
export async function analyze(input, options = {}) {
  const provider = options.provider || 'mi';

  if (provider === 'local' || options.tryLocal) {
    const local = await analyzeLocal(input, options);
    if (local) return local;
    if (provider === 'local') {
      return analyzeMI(input, options);
    }
  }

  if (provider === 'rules') {
    return analyzeRules(input);
  }

  return analyzeMI(input, options);
}

/** Batch analyze (sequential; local agent may be slow). */
export async function analyzeBatch(items, options = {}) {
  const results = [];
  for (const item of items) {
    results.push(await analyze(item, options));
  }
  return results;
}

/** Legacy Senza helpers */
export function suggestFromFilename(filePath, context) {
  const r = analyzeRules({ filePath, tags: {}, context });
  return {
    ...r.fields,
    confidence: r.confidence,
  };
}

export function suggestFromTags(track) {
  const r = analyzeRules({ filePath: track.path || '', tags: track, context: {} });
  return {
    ...r.fields,
    confidence: r.confidence,
  };
}
