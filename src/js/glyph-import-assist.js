import { runGlyphAnalysis } from './glyph-ui.js';
import { trackNeedsAttention } from './library.js';


export async function scanImportedTracks(importedTracks, state, locale, api) {
  if (!importedTracks?.length || !api) {
    return { checked: 0, canImprove: 0, total: 0 };
  }

  const weak = importedTracks.filter((t) => trackNeedsAttention(t));
  let canImprove = 0;
  const limit = Math.min(weak.length, 15);

  for (let i = 0; i < limit; i += 1) {
    const tr = weak[i];
    try {
      const analysis = await runGlyphAnalysis(tr, state, locale, api);
      const score = analysis?.result?.confidence?.score ?? 0;
      if (score >= 52) canImprove += 1;
    } catch {
      
    }
  }

  return {
    checked: limit,
    canImprove,
    total: importedTracks.length,
    weak: weak.length,
  };
}
