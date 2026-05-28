import { t } from './i18n.js';

/** Apple-style hint control: ? button with tooltip on hover/focus/click. */
export function hintButton(hintKey, locale, { labelKey } = {}) {
  const text = t(hintKey, locale);
  const label = labelKey ? t(labelKey, locale) : '';
  return `
    <span class="hint-wrap">
      ${label ? `<span class="hint-label">${label}</span>` : ''}
      <button type="button" class="hint-btn" aria-label="${text}" data-hint="${escapeAttr(text)}">?</button>
      <span class="hint-popover" role="tooltip">${text}</span>
    </span>`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function positionHintPopover(btn, pop) {
  if (!pop._hintPortaled) {
    document.body.appendChild(pop);
    pop._hintPortaled = true;
  }
  pop.style.position = 'fixed';
  pop.style.maxWidth = `${Math.min(360, window.innerWidth - 24)}px`;
  pop.style.width = 'max-content';
  pop.style.left = '0';
  pop.style.top = '0';
  pop.classList.add('hint-popover--measuring');
  const popRect = pop.getBoundingClientRect();
  pop.classList.remove('hint-popover--measuring');
  const btnRect = btn.getBoundingClientRect();
  const gap = 10;
  const pad = 12;
  let top;
  if (btnRect.top >= popRect.height + gap + pad) {
    top = btnRect.top - gap - popRect.height;
    pop.dataset.placement = 'top';
  } else {
    top = btnRect.bottom + gap;
    pop.dataset.placement = 'bottom';
  }
  let left = btnRect.left + btnRect.width / 2 - popRect.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - popRect.width - pad));
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.style.transform = 'none';
}

function showHint(btn, pop) {
  positionHintPopover(btn, pop);
  pop.classList.add('hint-popover--visible');
}

function hideHint(pop) {
  pop.classList.remove('hint-popover--visible');
}

export function bindHints(root = document) {
  root.querySelectorAll('.hint-btn').forEach((btn) => {
    if (btn.dataset.hintBound === '1') return;
    btn.dataset.hintBound = '1';
    const pop = btn.parentElement?.querySelector('.hint-popover');
    if (!pop) return;
    const show = () => showHint(btn, pop);
    const hide = () => hideHint(pop);
    btn.addEventListener('mouseenter', show);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('focus', show);
    btn.addEventListener('blur', hide);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pop.classList.contains('hint-popover--visible')) hide();
      else show();
    });
    window.addEventListener(
      'scroll',
      () => {
        if (pop.classList.contains('hint-popover--visible')) positionHintPopover(btn, pop);
      },
      true
    );
  });
}
