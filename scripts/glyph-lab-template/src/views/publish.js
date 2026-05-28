import { esc } from '../util.js';

export function renderPublish() {
  return `
    <div class="panel" style="max-width:640px;margin-bottom:20px">
      <div class="panel-head"><strong>Публикация в Glyph-MI (git)</strong></div>
      <ul class="checklist" style="padding:16px 20px">
        <li><input type="checkbox" id="c1"> <label for="c1">Убраны имена друзей и contributorId из публичного pack</label></li>
        <li><input type="checkbox" id="c2"> <label for="c2">Нет абсолютных путей (только rel под music/)</label></li>
        <li><input type="checkbox" id="c3"> <label for="c3">Проверено ≥10 примеров вручную</label></li>
        <li><input type="checkbox" id="c4"> <label for="c4">Файл лежит в <code>knowledge/public/</code></label></li>
        <li><input type="checkbox" id="c5"> <label for="c5">Commit + push в github.com/FlokeStudio/Glyph-MI</label></li>
      </ul>
    </div>
    <div class="panel">
      <div class="panel-head"><strong>Команды (после копирования pack)</strong></div>
      <pre class="pack-preview" style="margin:16px">cd path/to/Glyph-MI
git add knowledge/public/your-pack.json
git commit -m "knowledge: add pack v1"
git push</pre>
      <p style="padding:0 16px 16px;color:var(--text-muted)">
        Senza подтянет публичные знания при следующей интеграции MI. Сырые логи в git не кладём.
      </p>
    </div>`;
}
