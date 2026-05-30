import { t, tf } from './i18n.js';
import { FLOW_MODES } from './flow.js';

const BLOB_COUNT = 9;

function ambientHtml() {
  const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => `<span class="flow-blob flow-blob--${i + 1}"></span>`).join('');
  return `<div class="flow-ambient" aria-hidden="true">${blobs}</div>`;
}

export function renderFlowView(locale, { mode, wave = [], generating = false, trackCount = 0, glyphEnabled = true }) {
  const modes = FLOW_MODES.map(
    (id) =>
      `<button type="button" class="flow-mode${mode === id ? ' flow-mode--active' : ''}" data-flow-mode="${id}">${t(`flow.mode.${id}`, locale)}</button>`
  ).join('');

  const waveMeta =
    wave.length > 0
      ? `<p class="flow-wave-meta">${tf('flow.waveReady', locale, { n: wave.length })}</p>`
      : '';

  const startLabel = generating ? t('flow.generating', locale) : wave.length ? t('flow.newWave', locale) : t('flow.start', locale);
  const startId = wave.length && !generating ? 'btnFlowShuffle' : 'btnFlowStart';

  return `
    <div class="flow-view flow-view--idle">
      ${ambientHtml()}
      <div class="flow-body">
        <header class="flow-header">
          ${glyphEnabled ? `<span class="flow-brand">GLYPH</span><span class="flow-version">2.2-O</span>` : `<span class="flow-brand flow-brand--senza">SENZA</span>`}
        </header>

        <div class="flow-center">
          <button type="button" class="flow-main" id="${startId}" ${!trackCount ? 'disabled' : ''} aria-busy="${generating}">
            <span class="flow-main-inner">${startLabel}</span>
          </button>
          ${waveMeta}
        </div>

        <div class="flow-modes" role="tablist" aria-label="${t('flow.modesLabel', locale)}">${modes}</div>

        <div class="flow-bar">
          <button type="button" class="flow-bar-btn flow-bar-btn--primary" id="btnFlowPlay" ${wave.length ? '' : 'disabled'}>${t('flow.playWave', locale)}</button>
          <span class="flow-bar-meta">${tf('flow.sub', locale, { n: trackCount })}</span>
        </div>
      </div>
    </div>`;
}
