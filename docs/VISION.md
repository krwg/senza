# Senza — product vision

## Problem

Local players play music fine but fail the **collection lifecycle**: download → tags → covers → folders → import → rescan. Senza owns that loop offline.

## What Senza is (1.1 Legato)

Offline-first **library + player** with **Glyph2.1-O** built in: import, organize, fix metadata, discover duplicates, listen with **Flow**, remember what you played — no account, no streaming.

## Shipped in 1.1.0 Legato

| Area | Status |
|------|--------|
| Multi-format tags | MP3, FLAC, OGG, M4A, AAC, WAV write |
| BPM import | librosa (optional) + music-tempo fallback |
| Library backup | `senza-library.zip` export/import |
| Player | Shuffle, repeat, crossfade, ReplayGain, hotkeys, media keys |
| Discovery | Favorites, Recently played, smart playlists, fuzzy search |
| Lyrics | Local `.lrc` sidecar |
| Library watch | Auto-import from watched folder |
| ONNX genre | Ready when ≥500 labeled rows + model file |
| Platforms | Windows + macOS + Linux builds |
| Tests | Vitest unit tests |

## Shipped in 1.0.0 Vivo

| Area | Status |
|------|--------|
| Library views | Tracks, Albums, Artists, Playlists, Collection |
| Import | Files, folder, drag & drop → `music/Artist/Album/` |
| Playback | Queue, persist, mini + fullscreen player |
| Tags | MP3 write; cover crop; bulk editor |
| **Glyph2.1-O** | Pipeline, vault scan, batch, auto-import, toggle off |
| **Flow** | Wave, modes, ambient + BPM pulse |
| **Journal** | Usage, listening time, tops, Time Capsule |
| Vault | Collection score, attention lists, album infer |
| Profile | Identicon + custom avatar |
| i18n | EN / RU |

## Roadmap (after Legato)

- iOS companion (exploratory)
- Deeper gapless album playback
- ONNX genre model training pipeline (export → train → ship)

## Signature metrics

**Collection Health** (Vault) — score /100: tags, covers, duplicates, attention tracks.

---

by Floke · Floke Studio
