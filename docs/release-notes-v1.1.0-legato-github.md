# Senza 1.1.0 Legato

**Legato** — плавное, связное прослушивание: кроссфейд, теги для всех основных форматов, переносимая библиотека и полноценный плеер. **Glyph2.2-O** — жанр с учётом BPM-анализа.

## Highlights

- **Теги** — запись MP3, FLAC, OGG, M4A, AAC, WAV (+ обложки)
- **BPM при импорте** — librosa (если есть Python) или music-tempo
- **Экспорт/импорт** — `senza-library.zip` в Настройки → Библиотека
- **Плеер** — shuffle, repeat, crossfade 0–8 с, ReplayGain, `.lrc` тексты
- **Горячие клавиши** — Space, стрелки, M, L · системные media keys
- **Избранное** и **Недавно слушали** в сайдбаре
- **Умные плейлисты** — давно не слушал, избранное, недавно добавлено
- **Fuzzy search** · **цвет акцента** · **watched folder**
- **Сайдбар** — вкл/выкл разделов, порядок ↑↓
- **macOS / Linux** сборки · **Vitest** (`npm test`)

### Fixes

- «Недавно слушали» играет по клику
- Shuffle не путает трек при явном выборе
- Crossfade на одном audio-элементе
- Repeat-one с иконкой «1»
- Выравнивание строк треков и панелей настроек

## Downloads

Windows x64 NSIS + Portable · macOS dmg/zip · Linux AppImage/deb — из **Assets** релиза.

## Upgrade from 1.0 Vivo

| | |
|---|---|
| State | `senza-state.json` совместим; появятся `favoriteIds`, новые settings |
| Library | без изменений путей |
| Glyph | **2.2-O** (было 2.1-O) |

Полный список: [`CHANGELOG.md`](../CHANGELOG.md)

---

by Floke · krwg
