import { api } from '../api.js';
import { esc } from '../util.js';

export async function renderDashboard() {
  const s = await api.status();
  return `
    <div class="grid-3">
      <div class="stat-card">
        <div class="value">${s.learnLines ?? 0}</div>
        <div class="label">строк в learn.jsonl (imports)</div>
      </div>
      <div class="stat-card">
        <div class="value">${s.counts?.imports?.files ?? 0}</div>
        <div class="label">файлов в data/imports</div>
      </div>
      <div class="stat-card">
        <div class="value">${s.counts?.packs?.files ?? 0}</div>
        <div class="label">пакетов в data/packs</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><strong>Быстрый старт</strong></div>
      <div style="padding:16px;line-height:1.6;color:var(--text-muted)">
        <p>1. Скопируй экспорт Senza в <code>data/imports/имя-друга/</code></p>
        <p>2. <strong>Импорты</strong> → открой <code>learn.jsonl</code></p>
        <p>3. <strong>Кураторство</strong> → good / bad / skip → экспорт pack</p>
        <p>4. <strong>Публикация</strong> → чеклист → Glyph-MI <code>knowledge/public/</code></p>
        <p class="muted" style="margin-top:12px">Data: ${esc(s.dataRoot || '')}</p>
      </div>
    </div>`;
}
