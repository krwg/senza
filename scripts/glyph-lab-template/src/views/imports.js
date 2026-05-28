import { api } from '../api.js';
import { esc, formatBytes, toast } from '../util.js';

export async function renderImports(ctx) {
  const { tree } = await api.tree('imports');
  const files = tree.filter((f) => f.type === 'file');
  const dirs = tree.filter((f) => f.type === 'dir');

  return `
    <div class="split">
      <div class="panel">
        <div class="panel-head">
          <strong>data/imports</strong>
          <span class="muted">${dirs.length} папок · ${files.length} файлов</span>
        </div>
        <ul class="file-list" id="importFileList">
          ${tree
            .map((f) => {
              if (f.type === 'dir') {
                return `<li class="dir">📁 ${esc(f.path)}</li>`;
              }
              const active = ctx.state.importPath === f.path ? ' class="active"' : '';
              return `<li data-path="${esc(f.path)}"${active}>📄 ${esc(f.name)} <span class="muted">${formatBytes(f.size)}</span></li>`;
            })
            .join('')}
        </ul>
      </div>
      <div class="panel">
        <div class="panel-head"><strong id="importPreviewTitle">Выберите файл</strong></div>
        <div id="importPreview" style="padding:16px" class="muted">learn.jsonl или manifest.json</div>
      </div>
    </div>`;
}

export function bindImports(root, ctx) {
  root.querySelectorAll('#importFileList li[data-path]').forEach((li) => {
    li.addEventListener('click', async () => {
      const path = li.dataset.path;
      ctx.state.importPath = path;
      ctx.state.curatePath = path.endsWith('.jsonl') ? path : null;
      const title = root.querySelector('#importPreviewTitle');
      const prev = root.querySelector('#importPreview');
      title.textContent = path;
      try {
        const data = await api.read(path);
        if (data.kind === 'jsonl') {
          prev.innerHTML = `<p><strong>${data.entries.length}</strong> записей</p>
            <p class="muted">Откройте раздел <strong>Кураторство</strong> для разметки.</p>
            <button type="button" class="btn primary" id="goCurate">Кураторство →</button>`;
          root.querySelector('#goCurate')?.addEventListener('click', () => {
            ctx.state.curatePath = path;
            ctx.navigate('curate');
          });
        } else {
          prev.innerHTML = `<pre class="pack-preview">${esc(JSON.stringify(data.data ?? data.text, null, 2))}</pre>`;
        }
        toast(`Загружен ${path}`);
      } catch (e) {
        prev.textContent = e.message;
      }
      root.querySelectorAll('#importFileList li').forEach((el) => el.classList.remove('active'));
      li.classList.add('active');
    });
  });
}
