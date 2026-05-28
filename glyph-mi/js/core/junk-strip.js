/** Strip download-site junk from filenames (shared by normalize + parser). */

const JUNK_BRACKET = [
  /\s*[\[\(](?:official\s*)?video(?:\s*clip)?[\]\)]/gi,
  /\s*[\[\(](?:official\s*)?(?:audio|lyrics?|mv|music\s*video)[\]\)]/gi,
  /\s*[\[\(]\s*\d{3,4}p?\s*[\]\)]/gi,
  /\s*[\[\(](?:hd|hq|4k|8k|1080p|720p)[\]\)]/gi,
  /\s*[\[\(](?:slowed\s*\+\s*reverb|slowed|reverb|sped\s*up|nightcore)[\]\)]/gi,
  /\s*[\[\(](?:clean|explicit|radio\s*edit)[\]\)]/gi,
  /\s*[\[\(]\d{1,3}[\]\)]\s*$/gi,
  /\s*[\[\(](?:copy|копия)\s*\d*[\]\)]/gi,
];

const JUNK_PREFIX = [
  /^\s*[\[\(]?(?:free|free\s*for\s*profit)\s*[\]\]]?\s*[-–—:]\s*/i,
  /^\s*\[?\s*free\s*[\]\]]?\s*/i,
];

const NOISE_WORDS =
  /\b(final|master|demo|edit|remix|extended|version|v\d+|prod\.?|produced\s+by|ft\.?|feat\.?|featuring)\b/gi;

export function stripFilenameJunk(raw) {
  let s = String(raw || '').trim();
  for (const re of JUNK_PREFIX) s = s.replace(re, '');
  for (const re of JUNK_BRACKET) s = s.replace(re, '');
  s = s
    .replace(NOISE_WORDS, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}
