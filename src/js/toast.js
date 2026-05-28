let hideTimer = null;

export function showToast(message, type = 'info', durationMs = 4200) {
  let root = document.getElementById('toastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toastRoot';
    root.className = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  if (hideTimer) clearTimeout(hideTimer);

  root.className = `toast-root toast-root--${type}`;
  root.textContent = message;
  root.classList.add('toast-root--visible');

  hideTimer = setTimeout(() => {
    root.classList.remove('toast-root--visible');
  }, durationMs);
}
