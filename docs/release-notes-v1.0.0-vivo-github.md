# Senza 1.0.0 — Vivo

**Offline-first music library and player — your collection, your files.**

Codename **Vivo** marks the first major release: built-in **Glyph2.1-O** metadata intelligence, a new **Flow** home screen, and a richer local **Journal** — still 100% offline for playback, no account, no streaming.

## Highlights

- **Glyph2.1-O** — smart tags from filenames, folders, knowledge packs, library KNN, optional MusicBrainz / AcoustID / Ollama; diff UI, batch fill, duplicate scan, SQLite event log.
- **Flow** — personal wave (~32 tracks), mood/BPM-driven ambient visuals, four discovery modes.
- **Journal** — time in app, listening time, weekly top artists & tracks, Time Capsule (Settings only).
- **Toggle Glyph off** — plain tag editor and SENZA branding on Flow when you want zero AI.
- **UI polish** — centered Now Playing / fullscreen in the content area; adaptive settings; fixed hint tooltips.

## Install

Windows x64 installer and portable build from **Assets** below (built with `npm run electron:build`).

```bash
git clone https://github.com/FlokeStudio/Senza.git
cd Senza
npm install
npm run electron:dev:watch
```

## Full changelog

See [CHANGELOG.md](../CHANGELOG.md) and [README.md](../README.md) for the complete feature list.

## Glyph docs

[Glyph-MI/GUIDE.ru.md](https://github.com/FlokeStudio/Glyph-MI/blob/main/GUIDE.ru.md) — single source for Glyph2.1-O pipeline, packs, logging, and Lab workflow.

---

**License:** GPL-3.0 · **Floke Studio**
