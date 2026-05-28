import { api } from '../api.js';
import { esc, fmtTags, entryId, toast } from '../util.js';

const state = {
  path: null,
  entries: [],
  curated: {},
};

export async function renderCurate(ctx) {
  const path = ctx.state.curatePath;
  if (!path) {
    return `<div class="empty">
      <p>Выберите <code>learn.jsonl</code> в разделе <strong>Импорты</strong></p>
      <button type="button" class="btn" data-goto="imports">Перейти к импортам</button>
    </div>`;
  }

  const data = await api.read(path);
  const curatedRes = await api.getCurated(path);
  state.path = path;
  state.entries = data.entries || [];
  state.curated = curatedRes.curated || {};

  const good = Object.values(state.curated).filter((v) => v === 'good').length;

  return `
    <div class="toolbar">
      <span class="muted">${esc(path)}</span>
      <span class="tag good">${good} good</span>
      <input type="search" id="curateQ" placeholder="Поиск…">
      <select id="curateEvent">
        <option value="">Все события</option>
        <option value="tag_save">tag_save</option>
        <option value="glyph_apply_all">glyph_apply_all</option>
        <option value="glyph_apply_field">glyph_apply_field</option>
      </select>
      <select id="curateStatus">
        <option value="">Любой статус</option>
        <option value="pending">pending</option>
        <option value="good">good</option>
        <option value="bad">bad</option>
        <option value="skip">skip</option>
      </select>
      <button type="button" class="btn primary" id="saveCurated">Сохранить разметку</button>
      <button type="button" class="btn" id="exportPack">Экспорт knowledge-pack</button>
    </div>
    <div class="panel table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Событие</th>
            <th>Файл</th>
            <th>До → После</th>
            <th>Glyph</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody id="curateRows"></tbody>
      </table>
    </div>`;
}

function filtered() {
  const q = document.getElementById('curateQ')?.value.trim().toLowerCase() || '';
  const ev = document.getElementById('curateEvent')?.value || '';
  const st = document.getElementById('curateStatus')?.value || '';
  return state.entries.filter((e) => {
    if (e._parseError) return true;
    if (ev && e.event !== ev) return false;
    const status = state.curated[entryId(e)] || 'pending';
    if (st && status !== st) return false;
    if (!q) return true;
    const hay = [e.event, e.ref?.basename, fmtTags(e.before), fmtTags(e.after), fmtTags(e.suggested)]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

function paintRows() {
  const tbody = document.getElementById('curateRows');
  if (!tbody) return;
  tbody.innerHTML = filtered()
    .map((e) => {
      if (e._parseError) {
        return `<tr><td colspan="5" class="bad">Ошибка строки ${e._line}</td></tr>`;
      }
      const id = entryId(e);
      const status = state.curated[id] || 'pending';
      const conf = e.glyph?.confidence?.score ?? '—';
      return `
      <tr data-id="${esc(id)}">
        <td><span class="tag">${esc(e.event || '')}</span></td>
        <td>
          <div>${esc(e.ref?.basename || '—')}</div>
          <div class="muted">${esc(e.ref?.rel || '')}</div>
        </td>
        <td class="diff">
          <div class="muted">до: ${esc(fmtTags(e.before))}</div>
          <div>после: ${esc(fmtTags(e.after))}</div>
          ${e.suggested ? `<div class="muted">glyph: ${esc(fmtTags(e.suggested))}</div>` : ''}
        </td>
        <td>${esc(e.glyph?.provider || '—')}<br><span class="muted">${esc(conf)}</span></td>
        <td>
          <span class="tag ${status}">${status}</span>
          <div class="curate-actions">
            ${['good', 'bad', 'skip'].map(
              (s) =>
                `<button type="button" class="btn sm${s === status ? ' active' : ''}" data-set="${s}" data-id="${esc(id)}">${s}</button>`
            ).join('')}
          </div>
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.curated[btn.dataset.id] = btn.dataset.set;
      paintRows();
    });
  });
}

export function bindCurate(root, ctx) {
  root.querySelector('[data-goto="imports"]')?.addEventListener('click', () => ctx.navigate('imports'));

  paintRows();
  ['curateQ', 'curateEvent', 'curateStatus'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', paintRows);
    document.getElementById(id)?.addEventListener('change', paintRows);
  });

  document.getElementById('saveCurated')?.addEventListener('click', async () => {
    await api.saveCurated(state.path, state.curated);
    toast('Разметка сохранена');
  });

  document.getElementById('exportPack')?.addEventListener('click', async () => {
    const good = state.entries
      .filter((e) => !e._parseError && state.curated[entryId(e)] === 'good')
      .map((e) => ({
        ref: e.ref,
        event: e.event,
        before: e.before,
        suggested: e.suggested,
        after: e.after,
        glyph: e.glyph,
        accepted: e.accepted,
      }));
    if (!good.length) {
      toast('Нет записей со статусом good');
      return;
    }
    const name = `pack-${Date.now()}`;
    const pack = {
      format: 'glyph-knowledge-pack',
      version: 1,
      createdAt: new Date().toISOString(),
      source: state.path,
      examples: good,
    };
    const zone = confirm('Сохранить в private/ ? (OK = private, Отмена = packs/)') ? 'private' : 'packs';
    const res = await api.writePack(name, pack, zone);
    toast(`Сохранено: ${res.path}`);
    ctx.navigate('packs');
  });
}
