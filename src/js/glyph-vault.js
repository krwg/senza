import { formatArtistsDisplay } from './artists.js';
import { t, tf } from './i18n.js';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function basename(path) {
  return String(path || '').split(/[/\\]/).pop() || '—';
}

function renderDuplicateGroups(scan, locale) {
  const groups = (scan.duplicateGroups || []).slice(0, 12);
  if (!groups.length) return '';

  const blocks = groups
    .map((g) => {
      const rows = g.tracks
        .map((tr) => {
          const isKeep = tr.id === g.keepId;
          return `
        <div class="glyph-dup-row${isKeep ? ' glyph-dup-row--keep' : ''}">
          <div class="glyph-dup-row-main">
            <div class="glyph-dup-name">${esc(basename(tr.path))}</div>
            <div class="glyph-dup-meta">${esc(formatArtistsDisplay(tr.artist))} — ${esc(tr.title || '—')}</div>
          </div>
          ${
            isKeep
              ? `<span class="tag tag-keep">${t('glyph.dupKeep', locale)}</span>`
              : `<button type="button" class="btn btn-sm btn-danger" data-glyph-remove-dup="${esc(tr.id)}">${t('glyph.dupRemove', locale)}</button>`
          }
        </div>`;
        })
        .join('');

      return `
      <div class="glyph-dup-group" data-dup-group="${esc(g.id)}">
        <div class="glyph-dup-group-head">
          <span class="glyph-dup-reason">${t(g.reasonKey || 'glyph.dupReasonTags', locale)}</span>
          <button type="button" class="btn btn-sm" data-glyph-remove-dup-group="${esc(g.id)}">${t('glyph.dupRemoveAll', locale)}</button>
        </div>
        ${rows}
      </div>`;
    })
    .join('');

  return `
    <div class="glyph-vault-dupes">
      <h3 class="glyph-vault-fixes-title">${tf('glyph.dupTitle', locale, { n: scan.duplicateGroupCount ?? groups.length })}</h3>
      <p class="glyph-vault-hint">${t('glyph.dupHint', locale)}</p>
      ${blocks}
    </div>`;
}

export function renderGlyphVaultSection(scan, locale, loading = false, glyphEnabled = true) {
  if (!glyphEnabled) {
    return `
    <section class="glyph-vault panel-block glyph-vault--off">
      <div class="glyph-vault-head">
        <span class="glyph-mark">◇</span>
        <strong>Glyph</strong>
        <span class="glyph-version">2.1-O</span>
      </div>
      <p class="glyph-vault-hint">${t('glyph.disabledVault', locale)}</p>
    </section>`;
  }
  if (loading) {
    return `
    <section class="glyph-vault panel-block">
      <div class="glyph-vault-head">
        <span class="glyph-mark">◇</span>
        <strong>Glyph</strong>
        <span class="muted">${t('glyph.vaultScanning', locale)}</span>
      </div>
    </section>`;
  }

  if (!scan && !loading) {
    return `
    <section class="glyph-vault panel-block glyph-vault--off">
      <div class="glyph-vault-head">
        <span class="glyph-mark">◇</span>
        <strong>Glyph</strong>
      </div>
      <p class="glyph-vault-hint">${t('glyph.vaultEmpty', locale)}</p>
    </section>`;
  }

  const insights = (scan.insights || [])
    .map((ins) => {
      const msg = ins.key
        ? tf(`glyph.insight.${ins.key}`, locale, ins.vars || {})
        : ins.message || '';
      return `<li class="glyph-vault-insight glyph-vault-insight--${esc(ins.severity || 'info')}">${esc(msg)}</li>`;
    })
    .join('');

  const previews = (scan.fixPreviews || [])
    .map((p) => {
      const s = p.suggested || {};
      const line = [formatArtistsDisplay(s.artist), s.title, s.album].filter(Boolean).join(' — ');
      return `
      <div class="glyph-vault-fix" data-glyph-fix="${esc(p.trackId)}">
        <div class="glyph-vault-fix-title">${esc(p.basename || '—')}</div>
        <div class="glyph-vault-fix-suggest">${esc(line)}</div>
        <div class="glyph-vault-fix-meta">
          <span class="tag">${esc(p.confidence?.level || '')}</span>
          <button type="button" class="btn btn-tag" data-edit-tags="${esc(p.trackId)}">${t('tags.edit', locale)}</button>
        </div>
      </div>`;
    })
    .join('');

  const dupes = renderDuplicateGroups(scan, locale);

  return `
    <section class="glyph-vault panel-block">
      <div class="glyph-vault-head">
        <span class="glyph-mark">◇</span>
        <strong>Glyph</strong>
        <span class="glyph-version">2.1-O</span>
        <button type="button" class="btn btn-sm" id="btnVaultGlyphRescan">${t('glyph.vaultRescan', locale)}</button>
        <button type="button" class="btn btn-sm btn-primary" id="btnGlyphBatch">${t('glyph.batchRun', locale)}</button>
      </div>
      <p class="glyph-vault-lead">${tf('glyph.vaultLead', locale, {
        help: scan.glyphCanHelp ?? 0,
        attention: scan.needsAttention ?? 0,
      })}</p>
      ${insights ? `<ul class="glyph-vault-insights">${insights}</ul>` : ''}
      ${dupes}
      ${
        previews
          ? `<div class="glyph-vault-fixes">
          <h3 class="glyph-vault-fixes-title">${t('glyph.vaultFixes', locale)}</h3>
          ${previews}
        </div>`
          : ''
      }
    </section>`;
}
