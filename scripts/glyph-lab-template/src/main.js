import { api } from './api.js';
import { toast } from './util.js';
import { renderDashboard } from './views/dashboard.js';
import { renderImports, bindImports } from './views/imports.js';
import { renderCurate, bindCurate } from './views/curate.js';
import { renderPacks, bindPacks } from './views/packs.js';
import { renderPublish } from './views/publish.js';
import { renderPlaybook } from './views/playbook.js';

const VIEWS = {
  dashboard: { title: 'Обзор', icon: '◆', render: renderDashboard },
  imports: { title: 'Импорты', icon: '📥', render: renderImports, bind: bindImports },
  curate: { title: 'Кураторство', icon: '✦', render: renderCurate, bind: bindCurate },
  packs: { title: 'Пакеты', icon: '📦', render: renderPacks, bind: bindPacks },
  publish: { title: 'Публикация', icon: '↑', render: renderPublish },
  playbook: { title: 'Playbook', icon: '📖', render: renderPlaybook },
};

const ctx = {
  view: 'dashboard',
  state: {
    importPath: null,
    curatePath: null,
    packPath: null,
  },
  navigate(view) {
    ctx.view = view;
    render();
  },
};

function buildNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = Object.entries(VIEWS)
    .filter(([k]) => k !== 'playbook')
    .map(
      ([id, v]) =>
        `<button type="button" class="nav-btn${ctx.view === id ? ' active' : ''}" data-view="${id}">
          <span>${v.icon}</span> ${v.title}
        </button>`
    )
    .join('');

  nav.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.navigate(btn.dataset.view));
  });

  document.querySelector('.sidebar-foot [data-view="playbook"]')?.addEventListener('click', () => {
    ctx.navigate('playbook');
  });
}

async function render() {
  const def = VIEWS[ctx.view] || VIEWS.dashboard;
  document.getElementById('viewTitle').textContent = def.title;
  document.getElementById('topbarActions').innerHTML = '';

  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Загрузка…</p>';

  try {
    main.innerHTML = await def.render(ctx);
    def.bind?.(main, ctx);
    buildNav();
  } catch (err) {
    main.innerHTML = `<div class="empty"><p>Ошибка: ${err.message}</p>
      <p class="muted">Запущен ли API? <code>node server.cjs</code> на :5176</p></div>`;
  }
}

document.getElementById('btnOpenData')?.addEventListener('click', async () => {
  try {
    await api.openData();
  } catch (e) {
    toast(e.message);
  }
});

buildNav();
render();
