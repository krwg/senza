# Glyph Lab (local copy)

This folder is created by `npm run glyph-lab` and is **gitignored**.

**GUI:** `npm run start` → http://localhost:5175  

**Start here (RU):** [`PLAYBOOK.ru.md`](./PLAYBOOK.ru.md) — команды, тест, обучение, экспорт.

## Layout

```
glyph-lab/
  app.js, index.html   — curator UI
  data/
    imports/           — Senza exports from you & friends (private)
    private/           — non-public knowledge packs
    packs/             — curated drafts before publishing
```

## Publish to public Glyph-MI

Only after review: copy sanitized packs to  
[glyph-mi](https://github.com/krwg/glyph-mi) → `knowledge/public/`.

Never commit `data/` to Senza or Glyph-MI without scrubbing.
