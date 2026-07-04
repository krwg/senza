const FEAT_RE = /\s+(?:feat\.?|ft\.?|featuring)\s+/i;
const AND_RE = /\s+&\s+/;
const COMMA_RE = /\s*,\s*/;

export function splitArtists(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let s = raw.trim();
  if (!s) return [];

  const parts = [];
  const featMatch = s.match(FEAT_RE);
  if (featMatch) {
    const idx = s.search(FEAT_RE);
    const main = s.slice(0, idx).trim();
    const feat = s.slice(idx + featMatch[0].length).trim();
    if (main) parts.push(...splitSimpleList(main));
    if (feat) parts.push(...splitSimpleList(feat));
    return dedupe(parts);
  }

  return dedupe(splitSimpleList(s));
}

function splitSimpleList(s) {
  if (AND_RE.test(s)) return s.split(AND_RE).map((p) => p.trim()).filter(Boolean);
  if (s.includes(',')) return s.split(COMMA_RE).map((p) => p.trim()).filter(Boolean);
  if (s.includes(';')) return s.split(/\s*;\s*/).map((p) => p.trim()).filter(Boolean);
  return [s.trim()].filter(Boolean);
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const key = name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}


export function joinArtists(artists) {
  return splitArtists(Array.isArray(artists) ? artists.join(', ') : artists).join('; ');
}


export function formatArtistsDisplay(artists) {
  return splitArtists(Array.isArray(artists) ? artists.join('; ') : artists).join(', ');
}


export function artistSlug(name) {
  const s = String(name || '').trim();
  if (!s) return 'unknown-artist';
  const ascii = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 80);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `a-${h.toString(36)}`;
}

export function trackIncludesArtist(track, artistName) {
  if (!track || !artistName) return false;
  const key = String(artistName).trim().toLowerCase();
  return splitArtists(track.artist).some((a) => a.toLowerCase() === key);
}


export function parseArtistTitle(filenameBase) {
  const dash = findTitleDash(filenameBase);
  if (!dash) return null;
  const artistPart = filenameBase.slice(0, dash.index).trim();
  const titlePart = filenameBase.slice(dash.index + dash.sepLen).trim();
  if (!artistPart || !titlePart) return null;
  const artists = splitArtists(artistPart);
  return {
    artists,
    artist: joinArtists(artists),
    title: titlePart,
  };
}

function findTitleDash(s) {
  const separators = [' - ', ' – ', ' — '];
  let best = -1;
  let sepLen = 3;
  for (const sep of separators) {
    const idx = s.lastIndexOf(sep);
    if (idx > 0 && idx >= best) {
      best = idx;
      sepLen = sep.length;
    }
  }
  return best >= 0 ? { index: best, sepLen } : null;
}
