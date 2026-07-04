import { analyze, isLocalAgentAvailable } from '@glyph/index.js';
import { analyzeLocal } from '@glyph/providers/local-agent.js';
import { runGlyphPipeline } from '@glyph/pipeline.js';
import { evaluateSuggestion } from '@glyph/core/suggestion-confidence.js';
import { sanitizeGlyphFields } from '@glyph/core/sanitize.js';
import { getGlyphKnowledgePacks } from './glyph-knowledge-packs.js';
import { enrichWithOnline } from './glyph-online.js';
import { trackWithInferredAlbum } from './glyph-album.js';
import { formatArtistsDisplay } from './artists.js';
import { trackNeedsAttention } from './library.js';
import { t, tf } from './i18n.js';
import { renderGlyphDiffHtml } from './glyph-diff.js';
import { logGlyphTelemetry, GLYPH_EVENTS } from './glyph-telemetry.js';
import { pickTags } from './glyph-learn.js';

export const GLYPH_VERSION = '2.2-O';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function confidenceClass(level) {
  return `glyph-confidence glyph-confidence--${level || 'low'}`;
}

function normEq(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function buildSummaryLine(f) {
  const artist = formatArtistsDisplay(f.artist);
  const title = f.title || '—';
  const tail = [f.album, f.year, f.genre].filter(Boolean).join(' · ');
  if (artist && title) return tail ? `${artist} — ${title} · ${tail}` : `${artist} — ${title}`;
  return title;
}

function buildInput(track, state) {
  const enriched = trackWithInferredAlbum(track, state.tracks);
  const siblings = state.tracks
    .map((tr) => trackWithInferredAlbum(tr, state.tracks))
    .filter(
      (tr) =>
        tr.id !== enriched.id &&
        tr.album === enriched.album &&
        tr.artist === enriched.artist
    );
  return {
    filePath: enriched.path,
    tags: enriched,
    context: {
      siblingTracks: siblings,
      folderHint: enriched.album || '',
    },
  };
}

function sourceBadges(result, locale) {
  const src = result?.sources || [];
  const badges = [];
  if (src.includes('glyph-mi') || src.includes('glyph-knowledge')) {
    badges.push(t('glyph.badgeMI', locale));
  }
  if (src.includes('glyph-rules')) badges.push(t('glyph.badgeRules', locale));
  if (src.includes('musicbrainz')) badges.push(t('glyph.badgeMB', locale));
  if (src.includes('acoustid')) badges.push(t('glyph.badgeAcoustid', locale));
  if (src.includes('glyph-knn')) badges.push(t('glyph.badgeKnn', locale) || 'KNN');
  if (src.includes('glyph-ml')) badges.push(t('glyph.badgeMl', locale) || 'ML');
  if (result?.provider === 'glyph-local') badges.push(t('glyph.badgeLocal', locale));
  return badges.length ? badges : [t('glyph.badgeRules', locale)];
}

export async function runGlyphAnalysis(track, state, locale, api) {
  const current = trackWithInferredAlbum(track, state.tracks);
  const input = buildInput(current, state);
  const tryLocal = Boolean(state.settings?.glyphTryLocal);
  const packs = await getGlyphKnowledgePacks(api);

  let libraryRows = [];
  if (api?.glyphLibraryFeatures && state.settings?.glyphUseKnn !== false) {
    try {
      libraryRows = (await api.glyphLibraryFeatures()) || [];
    } catch {
      libraryRows = [];
    }
  }

  let result = await analyze(input, {
    provider: 'mi',
    tryLocal: false,
    knowledgePacks: packs,
  });

  result = await runGlyphPipeline(current, state, result, {
    libraryRows,
    settings: state.settings || {},
  });

  if (api?.glyphMusicBrainzLookup || api?.glyphAcoustidLookup) {
    result = await enrichWithOnline(api, current, result, state.settings);
  }

  result = {
    ...result,
    fields: sanitizeGlyphFields(current.path, current, result.fields || {}),
  };

  const score = result.confidence?.score ?? 0;
  const ollamaThreshold = state.settings?.glyphOllamaThreshold ?? 42;
  let localOk = false;
  if (tryLocal && score < ollamaThreshold) {
    localOk = await isLocalAgentAvailable();
    if (localOk) {
      const local = await analyzeLocal(input, {});
      if (local?.fields) {
        const merged = { ...result.fields };
        let ollamaAdded = 0;
        for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
          if (!merged[key] && local.fields[key]) {
            merged[key] = local.fields[key];
            ollamaAdded += 1;
          }
        }
        const pipelineFields = { ...merged };
        result = {
          ...result,
          fields: sanitizeGlyphFields(current.path, current, merged),
          provider: 'glyph-local',
          sources: [...new Set([...(result.sources || []), 'glyph-local'])],
        };
        if (api?.glyphLog) {
          let sameAsPipeline = 0;
          for (const key of ['title', 'artist', 'album', 'genre']) {
            if (
              normEq(local.fields[key], pipelineFields[key]) ||
              (!local.fields[key] && !pipelineFields[key])
            ) {
              sameAsPipeline += 1;
            }
          }
          await logGlyphTelemetry(api, state.settings, current, GLYPH_EVENTS.OLLAMA, {
            before: pickTags(current),
            suggested: pickTags(local.fields),
            after: pickTags(result.fields),
            glyph: { provider: 'glyph-local', confidence: result.confidence, sources: result.sources },
            confidence: result.confidence,
            sources: result.sources,
            accepted: ollamaAdded > 0,
            context: { ollamaAdded, sameAsPipeline, pipelineScore: score },
          }).catch(() => {});
        }
      }
    }
  } else if (tryLocal) {
    localOk = await isLocalAgentAvailable();
  }

  const applyConf = evaluateSuggestion(current, result.fields, {
    score: result.confidence?.score,
    level: result.confidence?.level,
    reasons: result.confidence?.reasons || [],
    sources: result.sources || [],
  });

  result = {
    ...result,
    confidence: applyConf,
    meta: {
      needsAttention: trackNeedsAttention(current),
      packCount: packs.length,
      privatePacks: (state.glyphPrivatePackCount ?? 0),
    },
  };

  const usedMb = result.sources?.includes('musicbrainz');
  const usedAc = result.sources?.includes('acoustid');

  return {
    result,
    track: current,
    localOk,
    tryLocal,
    miOk: result.provider === 'glyph-mi' || String(result.provider || '').includes('glyph-mi'),
    usedMb,
    usedAc,
    packCount: packs.length,
    badges: sourceBadges(result, locale),
  };
}

export function rescoreGlyphFromForm(track, suggestedFields, priorAnalysis, locale) {
  const base = priorAnalysis?.result || {};
  const applyConf = evaluateSuggestion(track, suggestedFields, {
    score: base.confidence?.score ?? 40,
    reasons: base.confidence?.reasons || [],
    sources: base.sources || [],
  });
  return {
    ...priorAnalysis,
    result: {
      ...base,
      fields: { ...suggestedFields },
      confidence: applyConf,
    },
    badges: sourceBadges({ ...base, sources: base.sources }, locale),
  };
}

export function renderGlyphPanel(container, analysis, locale, onApply, onReject) {
  const { result, localOk, tryLocal, packCount, badges, track } = analysis;
  if (!container || !result) return;

  const f = result.fields;
  const c = result.confidence;
  const badgesHtml = (badges || [])
    .map((b) => `<span class="glyph-badge">${esc(b)}</span>`)
    .join('');

  const reasons = (c.reasons || [])
    .slice(0, 8)
    .map((r) => `<li>${esc(r)}</li>`)
    .join('');

  const chips = [
    ['title', f.title],
    ['artist', f.artist],
    ['album', f.album],
    ['genre', f.genre],
    ['year', f.year],
    ['trackNo', f.trackNo],
  ]
    .filter(([, v]) => v)
    .map(([key, value]) => {
      const cur = String(track?.[key] || '').trim();
      const next = String(value || '').trim();
      const changed = cur && next && cur !== next;
      const fill = !cur && next;
      const cls = changed ? ' glyph-chip--change' : fill ? ' glyph-chip--new' : '';
      return `<button type="button" class="glyph-chip${cls}" data-glyph-field="${key}" title="${t('glyph.applyField', locale)}">${esc(key === 'artist' ? formatArtistsDisplay(value) : value)}</button>`;
    })
    .join('');

  const changesLine =
    c.changes > 0
      ? tf('glyph.changesLine', locale, { n: c.changes })
      : t('glyph.noChanges', locale);

  const localHint =
    tryLocal && !localOk
      ? `<p class="glyph-status-line glyph-status-line--warn">${t('glyph.localUnavailable', locale)}</p>`
      : tryLocal && localOk
        ? `<p class="glyph-status-line glyph-status-line--ok">${t('glyph.localOk', locale)}</p>`
        : '';

  const onlineHint =
    analysis.usedMb || analysis.usedAc
      ? `<p class="glyph-status-line glyph-status-line--ok">${analysis.usedMb ? t('glyph.usedMB', locale) : ''}${analysis.usedMb && analysis.usedAc ? ' · ' : ''}${analysis.usedAc ? t('glyph.usedAcoustid', locale) : ''}</p>`
      : '';

  const summary = buildSummaryLine(f);
  const trackLabel = track?.title
    ? esc(`${formatArtistsDisplay(track.artist)} — ${track.title}`)
    : esc(track?.path || '');

  container.innerHTML = `
    <div class="glyph-panel" data-glyph-version="${esc(GLYPH_VERSION)}">
      <div class="glyph-head">
        <div class="glyph-brand">
          <span class="glyph-mark" aria-hidden="true">◇</span>
          <strong>Glyph</strong>
          <span class="glyph-version">${esc(GLYPH_VERSION)}</span>
        </div>
        <div class="${confidenceClass(c.level)}" title="${esc(changesLine)}">
          <span class="glyph-score">${c.score ?? '—'}</span>
          <span class="glyph-level">${esc(c.level)}</span>
        </div>
      </div>
      <p class="glyph-track-ref" title="${trackLabel}">${trackLabel}</p>
      <div class="glyph-badges">${badgesHtml}</div>
      <p class="glyph-meta-line">${tf('glyph.packsLine', locale, { n: packCount })}${result.meta?.needsAttention ? ` · ${t('glyph.needsWork', locale)}` : ''}</p>
      ${localHint}
      ${onlineHint}
      <p class="glyph-changes">${esc(changesLine)}</p>
      <p class="glyph-summary">${esc(summary)}</p>
      <details class="glyph-details glyph-details--diff" open>
        <summary>${t('glyph.diffTitle', locale)}</summary>
        ${renderGlyphDiffHtml(track, f, locale)}
      </details>
      ${
        chips
          ? `<div class="glyph-chips" role="group" aria-label="${t('glyph.suggestions', locale)}">${chips}</div>`
          : `<p class="glyph-empty">${t('glyph.noSuggestions', locale)}</p>`
      }
      ${
        reasons
          ? `<details class="glyph-details">
        <summary>${t('glyph.why', locale)}</summary>
        <ul class="glyph-reasons">${reasons}</ul>
      </details>`
          : ''
      }
      <div class="glyph-actions">
        <button type="button" class="btn btn-primary btn-sm" id="glyphApplyAll" ${chips ? '' : 'disabled'}>${t('glyph.applyAll', locale)}</button>
        <button type="button" class="btn btn-sm" id="glyphApplySave" ${chips ? '' : 'disabled'}>${t('glyph.applySave', locale)}</button>
        <button type="button" class="btn btn-sm btn-ghost" id="glyphReject">${t('glyph.reject', locale)}</button>
        <button type="button" class="btn btn-sm" id="glyphRerun">${t('glyph.rerun', locale)}</button>
      </div>
    </div>`;

  container.querySelector('#glyphApplyAll')?.addEventListener('click', () => onApply(f, { log: true }));
  container.querySelector('#glyphApplySave')?.addEventListener('click', () => onApply(f, { log: true, save: true }));
  container.querySelectorAll('.glyph-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.glyphField;
      onApply({ [key]: f[key] }, { log: true });
      btn.classList.add('glyph-chip--applied');
      setTimeout(() => btn.classList.remove('glyph-chip--applied'), 600);
    });
  });
  container.querySelector('#glyphReject')?.addEventListener('click', () => {
    if (onReject) onReject(f);
    else container.dispatchEvent(new CustomEvent('glyph-reject', { bubbles: true }));
  });
  container.querySelector('#glyphRerun')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('glyph-rerun', { bubbles: true }));
  });
}

export function renderGlyphLoading(container, track, locale) {
  if (!container) return;
  const label = track?.title
    ? `${formatArtistsDisplay(track.artist)} — ${track.title}`
    : track?.path || '';
  container.innerHTML = `
    <div class="glyph-panel glyph-panel--loading">
      <p class="glyph-loading">${t('glyph.loading', locale)}</p>
      <p class="glyph-loading-track">${esc(label)}</p>
    </div>`;
}
