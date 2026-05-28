/** Local 64-dim title embedding via hashed tokens (no LLM). */

const DIM = 64;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(tok, i) {
  let h = 2166136261;
  const s = `${tok}:${i}`;
  for (let c = 0; c < s.length; c += 1) {
    h ^= s.charCodeAt(c);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function titleEmbedding(title, artist = '') {
  const vec = new Float32Array(DIM);
  const tokens = [...tokenize(artist), ...tokenize(title)];
  if (!tokens.length) return vec;

  for (const tok of tokens) {
    const h = hashToken(tok, 0);
    const idx = h % DIM;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign * (1 + (tok.length % 5) / 5);
  }

  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i += 1) vec[i] /= norm;
  return vec;
}

export function vectorSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

export const TITLE_VECTOR_DIM = DIM;
