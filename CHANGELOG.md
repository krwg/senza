# Changelog

All notable changes to **Senza** are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [SemVer](https://semver.org/).

## [1.0.0] — Vivo — 2026-05-28

First major release: **Glyph2.1-O** metadata intelligence, **Flow** home experience, expanded **Journal**, and a polished desktop shell.

### Added

#### Glyph2.1-O (metadata intelligence)
- **Analysis pipeline** — filename parser (junk strip, type beats) → rules & knowledge packs → sanitize → ML heuristics → **KNN** over library features → optional **MusicBrainz** / **AcoustID** → **Ollama** when confidence is low (~42).
- **Tag editor panel** — confidence score, source badges (MI, Rules, MB, KNN, ML, Ollama), field diff view, per-field chips, Apply all / Apply & save / Reject / Re-run.
- **Auto-tag on import** — optional batch write after import (title, artist, album, genre, year, track #).
- **Music Vault (Library)** — collection scan, tag fix previews, duplicate groups (metadata, filename, optional chromaprint), insights, **Fill library** batch job with progress UI.
- **Glyph event log (SQLite)** — `library/glyph/glyph-log.sqlite` (`glyph_log`, `glyph_diff`, `tracks_features`); export JSONL for fine-tune.
- **Learning** — `learn.jsonl` legacy path, contributor ID, export to private knowledge pack, import Senza export → pack.
- **Analytics** in settings — indexed tracks, average score, counter-examples, Ollama stats, DB size.
- **Master toggle** — disable Glyph2.1-O for plain tag editor, no Flow GLYPH branding, no vault Glyph scan.
- **Knowledge packs** — built-in `core-v1`, `heuristics-v1`, user-learned pack from library; sync with [Glyph-MI](https://github.com/FlokeStudio/Glyph-MI).

#### Flow (home)
- **Personal wave** — ~32 tracks, no repeats per session; modes: Balanced, Favorites, Rarely played, Discover.
- **Ambient visuals** — cover-driven palette, smooth **pulse 0–10** and beat sync from BPM (`track.glyph` or default).
- **Recently added** strip with quick play.

#### Journal (Settings → Journal)
- **Time in Senza** — cumulative app usage (local).
- **Listening time** — sum of track durations from play log.
- **Top artists (7 days)** and **top tracks (7 days)**.
- **Music Time Capsule** — “about a year ago” highlight.
- Removed from sidebar quick nav (settings only).

#### Library & playback
- **Bulk tag editor** — multi-select tracks, shared fields.
- **Sort** — tracks, albums, artists (key + direction).
- **Artist photos** — local portrait per artist slug.
- **Album Focus** — album detail + play all.
- **Hints** — `?` tooltips on vault and settings (fixed positioning, no clipping).

#### Electron / main
- `glyph-import-meta.cjs`, `glyph-features.cjs`, `glyph-online.cjs`, `glyph-log-db.cjs`, `glyph-db.cjs`, `glyph-learn-rules.cjs` (60-day decay), `glyph-onnx.cjs` stub, `glyph-telemetry.js`.
- **better-sqlite3** for Glyph log DB.
- Scripts: `glyph:sync-mirror`, `glyph:push-mirror`, `glyph:import-export`, `glyph:download-tools`, `glyph-lab`.

### Changed
- Release codename **Vivo**; UI strings **Glyph2.1-O** (was 1.0-O / 2.0 in places).
- **Now Playing** mini panel and **fullscreen player** centered in the **main column** (not under sidebar).
- **Settings** panels use full available width; journal stats grid is responsive.
- Flow layout fills column height (no black strip under content).
- ML genre defaults — no longer biased to Pop without evidence.

### Fixed
- Hint popovers clipped by headers / overflow (portal + flip above/below).
- Circular import in Glyph normalize / filename-parser (`junk-strip.js`).
- Glyph batch duplicate `cancelRef`.
- Tag reading with music-metadata v10.

---

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

[1.0.0]: https://github.com/FlokeStudio/Senza/releases/tag/v1.0.0
[0.1.0]: https://github.com/FlokeStudio/Senza/releases/tag/v0.1.0
