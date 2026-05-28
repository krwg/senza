# 0.1.0 Coda: Your library, on your machine

**Senza** is an offline-first music player for people who own their files — no streaming, no accounts, no algorithms. **Coda** is the first public desktop build: import your music, fix tags and covers, browse your collection, and listen without the internet.

---

## Highlights

- **Your music stays yours** — files are copied into a local library (`music/Artist/Album/`). Nothing is uploaded.
- **Browse the way you think** — All Tracks, Albums, Artists, Playlists, and a **Collection** showcase mode.
- **Music Vault** — a Collection Score shows how healthy your library is (tags, covers, structure).
- **Tag editor + cover crop** — edit title, artist, album, genre, year, track #; pick any image, crop to square, save to MP3 tags.
- **Smart Metadata Assistant** — suggests tags from messy filenames (multi-artist aware).
- **Listening Journal** — recent plays, weekly top artists, and **Music Time Capsule** (“about a year ago…”).
- **Profile** — random name and pixel identicon (32×32), or your own avatar and nickname in the title bar.
- **English & Russian** — full UI localization.

## Fixes in this build

| Issue | Resolution |
|-------|------------|
| Covers / crop modal not showing | CSP allows `blob:`/`data:` images; unrestricted image picker + Electron file read |
| Journal stuck at top in Settings | Centered layout for embedded journal panel |
| Mixed EN/RU strings | Expanded i18n keys across views and settings |
| Header avatar misaligned | Title bar flex alignment for profile control |

## Downloads

| Artifact | Notes |
|----------|--------|
| `Senza-0.1.0-x64.exe` | NSIS installer (recommended) |
| `Senza-0.1.0-Portable.exe` | Portable — no install |

> Windows may show SmartScreen for unsigned builds: **More info → Run anyway**.

## Upgrade

| From | Action |
|------|--------|
| First install | Choose library folder on first import; state lives in `%APPDATA%/senza/` |

## Technical

- Electron **30**, Vite **5**, vanilla JS renderer.
- State: `%APPDATA%/senza/senza-state.json`; library: `%APPDATA%/senza/library/`.
- MP3 tag write via `node-id3`; metadata read via `music-metadata` v10.

---

**Full changelog:** [CHANGELOG.md](CHANGELOG.md)  
**Report issues:** https://github.com/FlokeStudio/Senza/issues  

Senza · offline-first · by Floke · krwg
