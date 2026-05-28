/** Styled in-app dialogs (replaces native Electron message boxes). */

let resolver = null;

function getEl() {
  return document.getElementById('senzaDialog');
}

export function showDialog({ title, message, detail, buttons = [], variant = 'default' }) {
  const root = getEl();
  const panel = document.getElementById('senzaDialogPanel');
  if (!root || !panel) {
    return Promise.resolve(0);
  }

  document.getElementById('senzaDialogTitle').textContent = title || '';
  document.getElementById('senzaDialogMessage').textContent = message || '';
  const detailEl = document.getElementById('senzaDialogDetail');
  if (detail) {
    detailEl.textContent = detail;
    detailEl.classList.remove('hidden');
  } else {
    detailEl.textContent = '';
    detailEl.classList.add('hidden');
  }

  panel.className = `senza-dialog-panel senza-dialog-panel--${variant}`;
  const actions = document.getElementById('senzaDialogActions');
  actions.innerHTML = buttons
    .map(
      (btn, i) =>
        `<button type="button" class="btn${btn.primary ? ' btn-primary' : ''}${btn.danger ? ' btn-danger' : ''}" data-dialog-idx="${i}">${btn.label}</button>`
    )
    .join('');

  root.classList.remove('hidden');

  return new Promise((resolve) => {
    resolver = resolve;
    actions.querySelectorAll('[data-dialog-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.dialogIdx);
        closeDialog(idx);
      });
    });
  });
}

function closeDialog(result = 0) {
  getEl()?.classList.add('hidden');
  if (resolver) {
    const r = resolver;
    resolver = null;
    r(result);
  }
}

export function initDialog() {
  document.getElementById('senzaDialogBackdrop')?.addEventListener('click', () => closeDialog(0));
  document.getElementById('senzaDialogCancel')?.addEventListener('click', () => closeDialog(0));
}

export async function confirmRemoveTrack(locale) {
  const ru = locale === 'ru';
  const idx = await showDialog({
    title: ru ? 'Удалить трек' : 'Remove track',
    message: ru ? 'Убрать трек из Senza?' : 'Remove this track from Senza?',
    detail: ru
      ? '«Только из списка» — файл останется на диске. «Удалить файл» — удалит аудио из папки библиотеки.'
      : '“Remove from list” keeps the file on disk. “Delete file” removes audio from your library folder.',
    variant: 'warning',
    buttons: ru
      ? [
          { label: 'Отмена' },
          { label: 'Только из списка' },
          { label: 'Удалить файл', danger: true },
        ]
      : [
          { label: 'Cancel' },
          { label: 'Remove from list' },
          { label: 'Delete file', danger: true },
        ],
  });
  if (idx === 0) return null;
  return { deleteFile: idx === 2 };
}

export async function confirmBulkRemove(count, locale) {
  const ru = locale === 'ru';
  const idx = await showDialog({
    title: ru ? 'Удалить треки' : 'Remove tracks',
    message: ru ? `Удалить ${count} треков из Senza?` : `Remove ${count} tracks from Senza?`,
    detail: ru
      ? '«Только из списка» — файлы останутся. «Удалить файлы» — удалит аудио из папки библиотеки.'
      : '“Remove from list” keeps files on disk. “Delete files” removes audio from your library folder.',
    variant: 'warning',
    buttons: ru
      ? [
          { label: 'Отмена' },
          { label: 'Только из списка' },
          { label: 'Удалить файлы', danger: true },
        ]
      : [
          { label: 'Cancel' },
          { label: 'Remove from list' },
          { label: 'Delete files', danger: true },
        ],
  });
  if (idx === 0) return null;
  return { deleteFile: idx === 2 };
}
