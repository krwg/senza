# Senza — architecture

Technical map for contributors. User-facing overview: [README](../README.md). Glyph engine: [Glyph-MI/GUIDE.ru.md](../../Glyph-MI/GUIDE.ru.md).

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Electron main (electron/main.cjs)                               │
│  IPC · import · tags · covers · playlists · profile · state      │
│  glyph-import-meta · glyph-online · glyph-log-db · glyph-db · …  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ contextBridge (preload.cjs)
┌────────────────────────────▼─────────────────────────────────────┐
│  Renderer (src/js/main.js + views)                             │
│  Flow · library views · player · settings · tag editor · Glyph UI│
└────────────────────────────┬─────────────────────────────────────┘
                             │ Vite alias @glyph → glyph-mi/js
┌────────────────────────────▼─────────────────────────────────────┐
│  Glyph-MI (glyph-mi/js) — pipeline, rules, KNN, ML, providers    │
└──────────────────────────────────────────────────────────────────┘
```

## Data locations

| Path | Contents |
|------|----------|
| `%APPDATA%/senza/senza-state.json` | tracks[], queue, playHistory, usage, settings, profile |
| `%APPDATA%/senza/library/music/` | imported audio `Artist/Album/track.ext` |
| `%APPDATA%/senza/library/covers/` | `{trackId}.jpg` sidecar covers |
| `%APPDATA%/senza/library/playlists/` | `{slug}/playlist.json` |
| `%APPDATA%/senza/library/glyph/` | cache, knowledge, `glyph-log.sqlite`, exports |
| `%APPDATA%/senza/library/profile-avatar.jpg` | optional custom profile image |

## Main process modules

| Module | Role |
|--------|------|
| `main.cjs` | Window, IPC registry, state load/save |
| `import.cjs` | Copy files; `normalizeImportMeta` before path resolve |
| `metadata.cjs` | `loadMusicMetadata()` (music-metadata v10) |
| `tags.cjs` | MP3 ID3 read/write via `node-id3` |
| `covers.cjs` | Cover files + embedded art on import |
| `library-tree.cjs` | Scan `music/` for settings tree |
| `glyph-import-meta.cjs` | Import-time title/artist normalization |
| `glyph-features.cjs` | BPM / mood features on tracks |
| `glyph-online.cjs` | MusicBrainz + AcoustID + disk cache |
| `glyph-log-db.cjs` | SQLite glyph_log / glyph_diff / tracks_features |
| `glyph-db.cjs` | Library feature index for KNN |
| `glyph-learn-rules.cjs` | Learned rules with 60-day decay |

## Renderer modules (selected)

| Module | Role |
|--------|------|
| `main.js` | Shell, routing, import, Glyph toggle, usage timer |
| `views.js` / `views-flow.js` | View HTML templates |
| `glyph-ui.js` | Run pipeline, render Glyph panel, diff |
| `glyph-scan.js` / `glyph-vault.js` | Vault scan UI |
| `glyph-batch.js` | Batch analyze + apply |
| `glyph-auto-tag.js` | Post-import auto-tag |
| `glyph-settings.js` | `isGlyphEnabled()` |
| `flow-ambient.js` / `flow.js` | Flow wave + visuals |
| `journal.js` | Play log, stats, formatMinutes |
| `player.js` / `player-chrome.js` | Audio, queue, overlays |
| `hint.js` | Portal tooltips |

## IPC surface (`window.senza`)

Core: `get-state`, `save-state`, `import-paths`, `read-tags`, `write-tags`, `cover-url`, playlists, profile, window controls.

Glyph (when used): `glyphMusicBrainzLookup`, `glyphAcoustidLookup`, `glyphLog`, `glyphLogExportDataset`, `glyphLearnExport`, `glyphDbSync`, `glyphDbUpsert`, `glyphLibraryFeatures`, `glyphOnlineStatus`, `glyphOpenExports`, etc. (see `electron/preload.cjs`).

## Playback flow

1. User selects track → `player.playTrack()` → `audio.src` via `fileUrl`.
2. `logPlay()` appends to `playHistory` with `durationSec`.
3. `persistPlayback()` saves queue + state (includes history).
4. `player-chrome` updates artwork; Flow syncs ambient if active.

## Glyph flow (renderer)

1. `runGlyphAnalysis()` → `runGlyphPipeline()` (`@glyph/pipeline.js`).
2. Optional online enrich → local Ollama if below threshold.
3. `renderGlyphPanel()` + `glyph-telemetry` log suggest/apply/reject.

Mirror sync: `npm run glyph:sync-mirror` (Glyph-MI → `glyph-mi/`).

## Build

- **Renderer:** Vite 5 → `dist/`
- **Desktop:** electron-builder → `release/Senza-1.0.0-x64.exe` (+ portable)
- **Version:** `senza.release.json` ← `npm run sync:version` ← `package.json`
