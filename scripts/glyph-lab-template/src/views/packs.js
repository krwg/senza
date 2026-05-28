import { api } from '../api.js';
import { esc, formatBytes } from '../util.js';

export async function renderPacks(ctx) {
  const [packsTree, privateTree] = await Promise.all([api.tree('packs'), api.tree('private')]);

  const renderList = (tree, zone) => {
    const files = tree.filter((f) => f.type === 'file' && f.name.endsWith('.json'));
    if (!files.length) return `<p class="muted">Пусто</p>`;
    return `<ul class="file-list">${files
      .map((f) => {
        const active = ctx.state.packPath === f.path ? ' class="active"' : '';
        return `<li data-zone="${zone}" data-path="${esc(f.path)}"${active}>${esc(f.name)} <span class="muted">${formatBytes(f.size)}</span></li>`;
      })
      .join('')}</ul>`;
  };

  return `
    <div class="split">
      <div>
        <div class="panel" style="margin-bottom:16px">
          <div class="panel-head"><strong>data/packs</strong> (черновики на публикацию)</div>
          ${renderList(packsTree, 'packs')}
        </div>
        <div class="panel">
          <div class="panel-head"><strong>data/private</strong></div>
          ${renderList(privateTree, 'private')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><strong id="packTitle">Пакет</strong></div>
        <div id="packBody" style="padding:16px" class="muted">Выберите JSON слева</div>
      </div>
    </div>`;
}

export function bindPacks(root, ctx) {
  root.querySelectorAll('.file-list li[data-path]').forEach((li) => {
    li.addEventListener('click', async () => {
      const path = li.dataset.path;
      ctx.state.packPath = path;
      const body = root.querySelector('#packBody');
      const title = root.querySelector('#packTitle');
      title.textContent = path;
      try {
        const data = await api.read(path);
        const ex = data.data?.examples?.length ?? 0;
        body.innerHTML = `
          <p><strong>${ex}</strong> примеров · ${esc(data.data?.format || '')}</p>
          <pre class="pack-preview">${esc(JSON.stringify(data.data, null, 2))}</pre>`;
      } catch (e) {
        body.textContent = e.message;
      }
      root.querySelectorAll('.file-list li').forEach((el) => el.classList.remove('active'));
      li.classList.add('active');
    });
  });
}
