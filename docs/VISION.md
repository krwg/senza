# Senza — product vision

## Problem

Local players play music fine but fail the **collection lifecycle**: download → tags → covers → folders → import → rescan. Senza owns that loop offline.

## What Senza is (1.0 Vivo)

Offline-first **library + player** with **Glyph2.1-O** built in: import, organize, fix metadata, discover duplicates, listen with **Flow**, remember what you played — no account, no streaming.

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

## Roadmap (after Vivo)

- Full tag write for FLAC and more formats
- Librosa BPM at import (today: heuristics / glyph features)
- Portable library export (`senza-library.zip`)
- iOS companion (exploratory)
- ONNX genre model when enough SQLite training rows

## Signature metrics

**Collection Health** (Vault) — score /100: tags, covers, duplicates, attention tracks.

---

by Floke · Floke Studio
