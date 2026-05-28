/** Glyph diff preview — before → after per field. */
import { formatArtistsDisplay } from './artists.js';
import { t } from './i18n.js';

const FIELDS = ['title', 'artist', 'album', 'genre', 'year', 'trackNo'];

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function displayVal(key, v) {
  if (!v) return '—';
  return key === 'artist' ? formatArtistsDisplay(v) : String(v);
}

function norm(v) {
  return String(v ?? '').trim();
}

/**
 * @returns {{ rows: Array, hasChanges: boolean }}
 */
export function buildGlyphDiff(track, suggestedFields) {
  const rows = [];
  for (const key of FIELDS) {
    const before = norm(track?.[key]);
    const after = norm(suggestedFields?.[key]);
    if (!after) continue;
    if (before === after) continue;
    const kind = !before ? 'new' : 'change';
    rows.push({ key, before, after, kind });
  }
  return { rows, hasChanges: rows.length > 0 };
}

export function renderGlyphDiffHtml(track, suggestedFields, locale) {
  const { rows, hasChanges } = buildGlyphDiff(track, suggestedFields);
  if (!hasChanges) {
    return `<p class="glyph-diff-empty">${t('glyph.diffNoChanges', locale)}</p>`;
  }
  const lines = rows
    .map((r) => {
      const label = t(`glyph.field.${r.key}`, locale) || r.key;
      return `
      <div class="glyph-diff-row glyph-diff-row--${r.kind}">
        <span class="glyph-diff-field">${esc(label)}</span>
        <span class="glyph-diff-before" title="${esc(r.before)}">${esc(displayVal(r.key, r.before))}</span>
        <span class="glyph-diff-arrow" aria-hidden="true">→</span>
        <span class="glyph-diff-after" title="${esc(r.after)}">${esc(displayVal(r.key, r.after))}</span>
      </div>`;
    })
    .join('');
  return `<div class="glyph-diff" role="region" aria-label="${t('glyph.diffTitle', locale)}">${lines}</div>`;
}
