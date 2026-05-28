# Changelog

All notable changes to **Senza** are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [SemVer](https://semver.org/).

## [0.1.0] — Coda — 2026-05-28

### Added

- **Desktop shell** — Electron 30 + Vite 5, custom title bar, dark/light themes, EN/RU UI.
- **Library** — import files/folder/drag-and-drop; copies into `music/Artist/Album/`; formats: mp3, flac, wav, ogg, m4a, aac.
- **Views** — All Tracks, Albums, Artists, Playlists, Collection mode, Music Vault (Collection Score).
- **Playback** — queue bar, drag reorder, persist between sessions, Now Playing panel, fullscreen player.
- **Tags** — read/write (MP3 ID3); cover picker + square crop; embed artwork in MP3 tags; Smart Metadata Assistant.
- **Playlists** — physical folders under `library/playlists/<name>/playlist.json`; add track from list or context menu.
- **Listening Journal** — local play history, weekly top artists, Music Time Capsule in Settings.
- **Album Focus** — album detail view with play-all.
- **Profile** — random display name + 32×32 identicon; custom avatar and nickname; chrome avatar button.
- **Settings** — BLIP-style nav: Appearance, Library (path + folder tree), Playback, Profile, Journal, About.
- **Design** — Floke tokens (Monocraft wordmark, gold accent), SF-style SVG icons.

### Fixed

- Tag reading with music-metadata v10 (`loadMusicMetadata`).
- Cover preview blocked by CSP (`img-src` for blob/data).
- Journal layout centered in Settings panel.
- Settings section titles use brand pixel font (Monocraft).

---

[0.1.0]: https://github.com/FlokeStudio/Senza/releases/tag/v0.1.0
