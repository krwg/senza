# Senza — architecture

Technical map for contributors. User-facing overview: [README](../README.md).

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Electron main (electron/main.cjs)                          │
│  IPC · import · tags · covers · playlists · profile · state │
└───────────────────────────┬─────────────────────────────────┘
                            │ contextBridge (preload.cjs)
┌───────────────────────────▼─────────────────────────────────┐
│  Renderer (src/js/main.js + views)                          │
│  Sidebar · content views · player · settings · tag editor   │
└─────────────────────────────────────────────────────────────┘
```

## Data locations

| Path | Contents |
|------|----------|
| `%APPDATA%/senza/senza-state.json` | tracks[], queue, playlists refs, playHistory, settings, profile |
| `%APPDATA%/senza/library/music/` | imported audio `Artist/Album/track.ext` |
| `%APPDATA%/senza/library/covers/` | `{trackId}.jpg` sidecar covers |
| `%APPDATA%/senza/library/playlists/` | `{slug}/playlist.json` |
| `%APPDATA%/senza/library/profile-avatar.jpg` | optional custom profile image |

## Main process modules

| Module | Role |
|--------|------|
| `main.cjs` | Window, IPC registry, state load/save |
| `import.cjs` | Copy files into library tree; dedupe by path |
| `metadata.cjs` | `loadMusicMetadata()` wrapper (music-metadata v10) |
| `tags.cjs` | MP3 ID3 read/write via `node-id3` |
| `covers.cjs` | Cover files + extract embedded art on import |
| `library-tree.cjs` | Scan `music/` for settings folder tree |

## Renderer modules

| Module | Role |
|--------|------|
| `main.js` | App shell, routing, bindings, import/tag/profile flows |
| `views.js` | HTML templates for all views + settings panels |
| `player.js` / `player-chrome.js` | Audio element, queue, progress, artwork |
| `library.js` | Grouping, vault score, search filter |
| `journal.js` | Play history, stats, time capsule |
| `cover-crop.js` | Square crop modal → JPEG buffer |
| `cover-art.js` | Gradient fallback when no cover file |
| `profile.js` | Identicon generator (32×32 cells) |
| `i18n.js` | EN/RU strings |
| `settings-nav.js` | Settings sidebar structure |
| `metadata-assistant.js` | Filename → tag suggestions |
| `artists.js` | Multi-artist parsing (`;`, feat., commas) |

## IPC surface (`window.senza`)

| Channel | Purpose |
|---------|---------|
| `get-state` / `save-state` | Persist app state |
| `import-paths` | Import files/folders |
| `read-tags` / `write-tags` | Tag editor |
| `cover-url` | `file://` URL for track cover |
| `pick-cover` / `read-file-binary` | Cover & avatar image pick |
| `library-tree` | Folder tree for settings |
| `profile-get` / `profile-save` / `profile-avatar-url` | Profile |
| `playlists-*` | CRUD playlist JSON on disk |
| `window-*` | Minimize / maximize / close |

## Playback flow

1. User selects track → `player.playTrack()` sets queue + `audio.src` via `fileUrl` IPC.
2. `logPlay()` appends to `state.playHistory`.
3. `player-chrome` updates metadata + `coverUrl` for artwork.

## Tag + cover write flow

1. Renderer sends `write-tags` with fields + optional `coverBuffer`.
2. Main always saves cover JPEG to `library/covers/{id}.jpg`.
3. MP3: `writeTags()` embeds image in file; other formats: state/metadata in app only.

## Build pipeline

1. `vite build` → `dist/`
2. `build:icons` → `build/icon.ico`
3. `electron-builder` packages `dist/` + `electron/`

## Design tokens

Shared with Floke: `src/styles/tokens.css` (accent `#c8a96e`, Monocraft brand, Space Mono UI).  
See [Floke-design](https://github.com/FlokeStudio/Floke-design).

---

by Floke · krwg
