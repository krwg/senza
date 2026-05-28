import { api } from '../api.js';
import { esc } from '../util.js';

export async function renderPlaybook() {
  try {
    const { text } = await api.playbook();
    return `<pre class="playbook">${esc(text)}</pre>`;
  } catch {
    return `<p class="empty">PLAYBOOK.ru.md не найден в glyph-lab/</p>`;
  }
}
