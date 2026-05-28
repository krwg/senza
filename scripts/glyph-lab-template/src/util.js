export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export function fmtTags(t) {
  if (!t) return '—';
  const parts = [t.artist, t.title, t.album].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export function entryId(e) {
  return e.id || `${e.ts}-${e.ref?.basename || Math.random()}`;
}

let toastTimer;
export function toast(msg, root = document.getElementById('toast')) {
  if (!root) return;
  root.textContent = msg;
  root.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.classList.add('hidden'), 3200);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
