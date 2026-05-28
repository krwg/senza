"""Stdio JSON RPC for Senza / Electron (no HTTP server)."""

from __future__ import annotations

import json
import sys

from glyph_mi import __version__
from glyph_mi.analyze import analyze_batch, analyze_one
from glyph_mi.knowledge import load_public_packs, reload_knowledge
from glyph_mi.vault import scan_library


def handle(req: dict) -> dict:
    cmd = req.get("cmd") or "ping"

    if cmd == "ping":
        packs = load_public_packs()
        return {
            "ok": True,
            "version": __version__,
            "provider": "glyph-mi",
            "knowledgePacks": len(packs),
            "packNames": [p.get("_source_file", "?") for p in packs],
        }

    if cmd == "reload_knowledge":
        n = reload_knowledge()
        return {"ok": True, "knowledgePacks": n}

    if cmd == "analyze":
        inp = req.get("input") or req
        return {"ok": True, "result": analyze_one(inp)}

    if cmd == "analyze_batch":
        items = req.get("items") or []
        return {"ok": True, "results": analyze_batch(items)}

    if cmd == "vault":
        tracks = req.get("tracks") or []
        max_preview = int(req.get("maxFixPreview") or 12)
        return {"ok": True, "result": scan_library(tracks, max_fix_preview=max_preview)}

    return {"ok": False, "error": f"unknown cmd: {cmd}"}


def main() -> None:
    try:
        raw = sys.stdin.read()
        req = json.loads(raw) if raw.strip() else {"cmd": "ping"}
        out = handle(req)
    except json.JSONDecodeError as e:
        out = {"ok": False, "error": f"invalid json: {e}"}
    except Exception as e:
        out = {"ok": False, "error": str(e)}

    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
