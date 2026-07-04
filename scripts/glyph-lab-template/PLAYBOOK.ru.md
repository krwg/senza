# Glyph — личная инструкция (krwg)

> Этот файл только у тебя локально (`glyph-lab/` в `.gitignore`).  
> Можно дописывать что угодно — в git не уйдёт.

---

## Карта папок

| Что | Где |
|-----|-----|
| Senza (приложение) | `E:\Floke Dev\Senza Dev` |
| JS-мост (временно) | `E:\Floke Dev\Glyph` |
| **Glyph MI** (публичный git) | https://github.com/krwg/glyph-mi |
| **Glyph Lab** (приватно) | `Senza Dev/glyph-lab/` ← ты здесь |
| Журнал на ПК | `%APPDATA%\senza\library\glyph\` (или userData Senza) |
| Публичная дока | `Floke Dev/Glyph-MI/GUIDE.ru.md` |

```
glyph-lab/data/
  imports/    ← сюда кладёшь экспорты от себя и друзей
  private/    ← непубличные knowledge-pack
  packs/      ← черновики перед публикацией в Glyph-MI
```

---

## 1. Запуск Senza для теста

```powershell
cd "E:\Floke Dev\Senza Dev"
npm run electron:dev:watch
```

**Проверить Glyph в редакторе тегов:**
1. Импорт трека или открыть существующий.
2. ПКМ → Edit tags / кнопка Tags.
3. Панель Glyph сверху: сводка, чипы, «Применить всё».
4. Сохранить теги → в журнал пишется `tag_save`.

**Проверить журнал:**
- Настройки → **Glyph** → счётчик записей растёт.
- «Папка экспортов» — открывает `library/glyph/exports/`.

**Сборка без Electron (только UI):**
```powershell
npm run build
```

---

## 2. Экспорт логов (ты или друг)

В Senza: **Настройки → Glyph**

1. Включить «Вести журнал обучения».
2. Указать **ID участника** (например `krwg`, `friend-01`).
3. Поработать: правки тегов, Apply от Glyph.
4. **Экспорт для Glyph** → папка `glyph-export-YYYY-MM-DD…/`
   - `learn.jsonl`
   - `manifest.json`

**Друзьям:** то же самое → zip папки → тебе в Telegram/Drive.

**Себе в Lab:**
```powershell
# скопировать вручную, например:
Copy-Item -Recurse "$env:APPDATA\senza\library\glyph\exports\glyph-export-*" `
  "E:\Floke Dev\Senza Dev\glyph-lab\data\imports\friend-01\"
```

(Точный путь userData: в Senza Настройки → Библиотека — смотри `library` path.)

---

## 3. Glyph Lab (GUI)

```powershell
cd "E:\Floke Dev\Senza Dev"
npm run glyph-lab
```

Откроется **http://localhost:5175** (GUI) + API **:5176** (файлы `data/`).

Разделы:
- **Обзор** — статистика
- **Импорты** — файлы в `data/imports/`, превью
- **Кураторство** — таблица, good/bad/skip, сохранение разметки, экспорт pack
- **Пакеты** — просмотр `packs/` и `private/`
- **Публикация** — чеклист перед Glyph-MI
- **Playbook** — эта инструкция внутри Lab

**Первый раз:** `npm run glyph-lab:init`

**Обновить GUI после изменений шаблона:**
```powershell
Remove-Item -Recurse "E:\Floke Dev\Senza Dev\glyph-lab"
npm run glyph-lab
```
(data/ можно заранее скопировать в бэкап)

---

## 4. Публикация в публичный Glyph-MI

Только после вычистки (без имён друзей, без абсолютных путей, без мусора):

1. Взять pack из `data/packs/`.
2. Проверить вручную 10–20 примеров.
3. Положить в репо **Glyph-MI** → `knowledge/public/` (например `core-v1.json`).
4. Commit + push в https://github.com/krwg/glyph-mi
5. Позже — Senza подтянет пакет при сборке / обновлении.

**Не коммитить:** `data/imports/`, сырой `learn.jsonl`, `data/private/`.

---

## 5. Обучение модели (когда будет Python в Glyph-MI)

> Сейчас в Senza работают **правила** (`glyph-rules`). Обучение MI — следующий этап.

**Плановый цикл (на твоём ПК, не у юзеров):**

```powershell
cd path\to\Glyph-MI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# 1) Собрать датасет из packs + public
python scripts/build_dataset.py --inputs ../Senza Dev/glyph-lab/data/packs/*.json

# 2) Fine-tune (когда скрипт появится)
python scripts/train.py --config configs/senza-v1.yaml

# 3) Прогон тестов
python -m pytest tests/

# 4) Локальный smoke-test analyze
python -m glyph_mi.analyze --json sample.json
```

Скрипты `train.py` / `build_dataset.py` появятся в Glyph-MI — здесь допишешь реальные команды.

**Пока MI нет — «обучение» = кураторство:**
- больше `good` примеров в knowledge-pack;
- правила в `Floke Dev/Glyph` можно дополнять вручную (JS).

---

## 6. Тест без Senza (только правила JS)

```powershell
cd "E:\Floke Dev\Senza Dev"
node --input-type=module -e "
import { analyze } from '../Glyph/src/index.js';
const r = await analyze({
  filePath: 'C:/music/Artist - Title.mp3',
  tags: {},
  context: {},
});
console.log(JSON.stringify(r, null, 2));
"
```

---

## 7. Ollama (опционально, не для обычных юзеров)

1. Установить Ollama, запустить модель.
2. Senza → Настройки → Glyph → включить локальный агент.
3. Если Ollama недоступна — fallback на правила (сообщение в панели Glyph).

Для релиза пользователям Ollama **не обязательна**.

---

## 8. Чеклист перед релизом Senza

- [ ] Редактор тегов: Glyph не ломает вёрстку
- [ ] Сохранение тегов MP3 ок
- [ ] Экспорт Glyph создаёт jsonl + manifest
- [ ] Журнал можно отключить (privacy)
- [ ] В git нет `glyph-lab/`, нет сырых логов
- [ ] В Glyph-MI только `knowledge/public/*` обезличено

---

## 9. Полезные команды (шпаргалка)

| Действие | Команда |
|----------|---------|
| Senza dev | `npm run electron:dev:watch` |
| Glyph Lab | `npm run glyph-lab` |
| Init Lab | `npm run glyph-lab:init` |
| Build Senza | `npm run build` |
| Release Senza | `npm run electron:build` |

---

## 10. Заметки (дописывай сам)

### Задания для друзей (шаблон)

```
1. Импорт 15–30 треков с кривыми именами файлов.
2. Открыть Music Vault → исправить 5 треков из «нужно внимание».
3. В 3 треках нажать Apply от Glyph и сохранить.
4. Настройки → Glyph → ID: friend-XX → Экспорт → прислать zip.
```

### Идеи

- Vault: batch Glyph
- Жанры / таблица как Spotify
- Встроить MI subprocess в Electron (без порта)

---

*Обновлено: 2026-05-28 · Floke*
