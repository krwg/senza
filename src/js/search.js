/** Fuzzy search helpers for library filtering. */

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyScore(hay, needle) {
  if (!needle) return 1;
  if (!hay) return 0;
  if (hay.includes(needle)) return 1 - needle.length / Math.max(hay.length, 1) * 0.2;
  const dist = levenshtein(hay.slice(0, Math.min(hay.length, needle.length + 8)), needle);
  const maxLen = Math.max(hay.length, needle.length, 1);
  const sim = 1 - dist / maxLen;
  return sim >= 0.72 ? sim : 0;
}

/**
 * @param {object[]} tracks
 * @param {string} query
 * @param {{ splitArtists?: (s: string) => string[] }} opts
 */
export function fuzzyFilterTracks(tracks, query, { splitArtists } = {}) {
  const q = normalize(query);
  if (!q) return tracks;
  const tokens = q.split(' ').filter(Boolean);
  return tracks
    .map((tr) => {
      const artistParts = splitArtists ? splitArtists(tr.artist).join(' ') : tr.artist;
      const hay = normalize([tr.title, artistParts, tr.album, tr.genre].join(' '));
      let score = 0;
      for (const tok of tokens) {
        score += fuzzyScore(hay, tok);
      }
      return { tr, score: score / tokens.length };
    })
    .filter((x) => x.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.tr);
}

export { normalize, fuzzyScore };
