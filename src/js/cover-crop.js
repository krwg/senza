import { t } from './i18n.js';

let cropState = null;
let bound = false;
let pendingOnConfirm = null;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function bindControlsOnce(locale) {
  if (bound) return;
  bound = true;

  document.getElementById('coverCropConfirm')?.addEventListener('click', async () => {
    const canvas = document.getElementById('coverCropCanvas');
    if (!canvas || !pendingOnConfirm) return;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      alert(t('cover.error', locale));
      return;
    }
    const buffer = await blob.arrayBuffer();
    pendingOnConfirm({ buffer, mime: 'image/jpeg' });
    closeCoverCropModal();
  });

  document.getElementById('coverCropCancel')?.addEventListener('click', closeCoverCropModal);
  document.getElementById('coverCropBackdrop')?.addEventListener('click', closeCoverCropModal);

  document.getElementById('coverCropZoom')?.addEventListener('input', (e) => {
    if (!cropState?.applyZoom) return;
    cropState.applyZoom(Number(e.target.value));
  });
}

export function openCoverCropModal(source, locale, onConfirm) {
  const modal = document.getElementById('coverCropModal');
  const canvas = document.getElementById('coverCropCanvas');
  const preview = document.getElementById('coverCropPreview');
  const playerPreview = document.getElementById('coverCropPlayerPreview');
  if (!modal || !canvas || !preview) return;

  pendingOnConfirm = onConfirm;
  bindControlsOnce(locale);

  const ctx = canvas.getContext('2d');
  const pctx = preview.getContext('2d');
  const ppctx = playerPreview?.getContext('2d');

  const img = new Image();
  const url =
    source instanceof Blob ? URL.createObjectURL(source) : typeof source === 'string' ? source : '';

  if (!url) return;

  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert(t('cover.error', locale));
  };

  img.onload = () => {
    if (source instanceof Blob) URL.revokeObjectURL(url);

    const size = 360;
    canvas.width = size;
    canvas.height = size;
    preview.width = 112;
    preview.height = 112;
    if (playerPreview) {
      playerPreview.width = 52;
      playerPreview.height = 52;
    }

    const baseScale = Math.max(size / img.width, size / img.height);
    const view = {
      img,
      size,
      scale: baseScale,
      drawW: img.width * baseScale,
      drawH: img.height * baseScale,
      offsetX: 0,
      offsetY: 0,
    };
    view.offsetX = (size - view.drawW) / 2;
    view.offsetY = (size - view.drawH) / 2;

    function redraw() {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, view.offsetX, view.offsetY, view.drawW, view.drawH);

      const sx = clamp(-view.offsetX / view.scale, 0, img.width - 1);
      const sy = clamp(-view.offsetY / view.scale, 0, img.height - 1);
      const sw = clamp(size / view.scale, 1, img.width - sx);
      const sh = clamp(size / view.scale, 1, img.height - sy);

      pctx.clearRect(0, 0, 112, 112);
      pctx.drawImage(img, sx, sy, sw, sh, 0, 0, 112, 112);
      if (ppctx && playerPreview) {
        ppctx.clearRect(0, 0, 52, 52);
        ppctx.drawImage(preview, 0, 0, 52, 52);
      }
    }

    function applyZoom(zoomValue) {
      const base = Math.max(size / img.width, size / img.height);
      view.scale = base * zoomValue;
      view.drawW = img.width * view.scale;
      view.drawH = img.height * view.scale;
      redraw();
    }

    cropState = { ...view, redraw, applyZoom };
    redraw();

    const zoom = document.getElementById('coverCropZoom');
    if (zoom) zoom.value = '1';

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.onpointerdown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = (e) => {
      if (!dragging) return;
      view.offsetX += e.clientX - lastX;
      view.offsetY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      redraw();
    };
    canvas.onpointerup = canvas.onpointercancel = () => {
      dragging = false;
    };

    modal.classList.remove('hidden');
    applyI18nLabels(locale);
  };

  img.src = url;
}

function applyI18nLabels(locale) {
  document.querySelectorAll('#coverCropModal [data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'), locale);
  });
}

export function closeCoverCropModal() {
  document.getElementById('coverCropModal')?.classList.add('hidden');
  cropState = null;
}
