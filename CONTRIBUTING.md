# Contributing to Senza

Thanks for helping improve Senza. This project is **GPL-3.0** — contributions are licensed under the same terms.

## Prerequisites

| | |
|---|---|
| Node.js | **20+** recommended |
| OS | **Windows 10/11** (primary build target) |
| npm | ships with Node |

## Quick setup

```bash
git clone https://github.com/FlokeStudio/Senza.git
cd Senza
npm install
```

## Development

**Hot reload (recommended):**

```bash
npm run electron:dev:watch
```

Runs Vite at `http://localhost:5173` and Electron with `VITE_DEV_SERVER_URL`.

**One-shot dev:**

```bash
npm run electron:dev
```

**Production-like run:**

```bash
npm run build
npx electron .
```

## Icons

Source: root `icon.svg` → `npm run build:icons` → `build/icon.ico` (+ PNG sizes).

## Building Windows installers

```bash
npm run electron:build
```

Outputs in `release/`:

| File | Type |
|------|------|
| `Senza-<version>-x64.exe` | NSIS installer |
| `Senza-<version>-Portable.exe` | Portable |

## Version & codename

Edit `senza.release.json` (name, version, codename, description).  
`npm run sync:version` copies version into `package.json` before build.

## Project layout (high level)

```
Senza Dev/
├── electron/          # main process: IPC, import, tags, covers, library tree
├── src/               # renderer: views, player, i18n, settings
├── docs/              # vision, architecture, release note drafts
├── scripts/           # sync-version, build-icons
├── senza.release.json # version source of truth
└── icon.svg           # app icon source
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for module map.

## Pull requests

1. Fork → branch from `main`.
2. Keep changes focused; match existing style (vanilla JS, Floke tokens, no emoji in UI).
3. Test with `npm run electron:dev:watch` on Windows.
4. Update `CHANGELOG.md` under **Unreleased** (or the target version) for user-visible changes.
5. Open a PR with a clear summary and screenshots for UI changes.

## Releases

Release body drafts live in `docs/release-notes-v*-github.md`.  
Follow [Floke release notes style](https://github.com/FlokeStudio/Floke-design/blob/main/docs/release-notes-style.md).

## Community docs

| Doc | Purpose |
|-----|---------|
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [docs/VISION.md](docs/VISION.md) | Product vision & roadmap |

---

by Floke · krwg
