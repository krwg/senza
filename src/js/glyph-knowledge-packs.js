import coreV1 from '../../glyph-mi/knowledge/public/core-v1.json';
import heuristicsV1 from '../../glyph-mi/knowledge/public/heuristics-v1.json';

const privateModules = import.meta.glob('../../glyph-mi/knowledge/private/*.json', { eager: true });

export const GLYPH_PUBLIC_PACKS = [
  coreV1,
  heuristicsV1,
  ...Object.values(privateModules).map((m) => m.default),
];


export async function getGlyphKnowledgePacks(api) {
  const packs = [...GLYPH_PUBLIC_PACKS];
  if (api?.glyphLearnedPack) {
    try {
      const learned = await api.glyphLearnedPack();
      if (learned?.id) packs.push(learned);
    } catch {
      
    }
  }
  return packs;
}
