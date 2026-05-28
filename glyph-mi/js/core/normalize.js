import { stripFilenameJunk } from './junk-strip.js';

const NOISE =
  /\b(final|v\d+|master|demo|edit|remix|official|audio|lyrics?|live|acoustic|instrumental|radio|clean|explicit|hd|hq|lossless|sped\s*up|nightcore)\b/gi;

const COPY_SUFFIX =
  /\s*[\(\[](?:copy|копия|duplicate|дубликат)(?:\s*\d+)?[\)\]]\s*$/i;

const COPY_PREFIX = /^\s*[\(\[]?(?:copy|копия)\s*\d*[\)\]]?\s*[-–—]?\s*/i;

const YEAR_RE = /\b(19|20)\d{2}\b/;

export function cleanBase(name) {
  return stripFilenameJunk(
    String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(COPY_PREFIX, '')
    .replace(COPY_SUFFIX, '')
    .replace(/^\d+[\s._-]*/, '')
    .replace(NOISE, '')
    .replace(/[[\](){}]/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  );
}

export function basename(filePath) {
  const base = String(filePath || '').split(/[/\\]/).pop() || '';
  return base.replace(/\.[^.]+$/, '');
}

export function extractYear(text) {
  const m = String(text || '').match(YEAR_RE);
  return m ? m[0] : '';
}

export function extractTrackNo(text) {
  const m = String(text || '').match(/^(\d{1,2})[\s._-]+/);
  return m ? m[1] : '';
}
