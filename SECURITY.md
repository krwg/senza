# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest release on [GitHub](https://github.com/krwg/senza/releases) | Yes |
| Older tags | Best effort |

Senza is a **local desktop** application. It reads and writes audio files and metadata on disk. It does **not** require sign-in and does **not** upload your library to Floke servers.

## Reporting a vulnerability

**Please do not file public issues** for undisclosed security problems.

1. Use **GitHub Security → Advisories → Report a vulnerability** on [krwg/senza](https://github.com/krwg/senza), **or**
2. Contact the maintainer via a private channel on their GitHub profile.

Include:

- Description and impact
- Steps to reproduce
- Affected version / commit
- Optional patch or mitigation

We aim to acknowledge within a few days; timelines depend on maintainer availability.

## In scope

- Remote code execution via IPC/preload bridge (`contextIsolation` bypass)
- Path traversal or arbitrary file write outside the library folder
- Unsafe handling of imported paths or tag/cover buffers
- XSS or script injection in renderer (CSP is strict: `default-src 'self'`)

## Out of scope

- Physical access to the machine or malware already running as the user
- Social engineering
- Issues in third-party dependencies without a Senza-specific exploit path
- Missing features (e.g. FLAC tag write) unless they enable unintended file corruption

## Safe use

- Import music only from sources you trust.
- Library path defaults to `%APPDATA%/senza/library/` — back up important collections before bulk tag edits.

---

by Floke · krwg
