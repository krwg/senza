"""Load and apply public knowledge packs."""

from __future__ import annotations

import json
import os
from pathlib import Path

_PACKS: list[dict] | None = None


def glyph_mi_root() -> Path:
    return Path(__file__).resolve().parent.parent


def public_knowledge_dir() -> Path:
    return glyph_mi_root() / "knowledge" / "public"


def load_public_packs(force: bool = False) -> list[dict]:
    global _PACKS
    if _PACKS is not None and not force:
        return _PACKS

    packs: list[dict] = []
    kdir = public_knowledge_dir()
    if not kdir.is_dir():
        _PACKS = packs
        return packs

    for fp in sorted(kdir.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            data["_source_file"] = fp.name
            packs.append(data)
        except (json.JSONDecodeError, OSError):
            continue

    extra = os.environ.get("GLYPH_KNOWLEDGE_PATH", "")
    if extra:
        ep = Path(extra)
        if ep.is_file() and ep.suffix == ".json":
            try:
                packs.append(json.loads(ep.read_text(encoding="utf-8")))
            except (json.JSONDecodeError, OSError):
                pass
        elif ep.is_dir():
            for fp in ep.glob("*.json"):
                try:
                    packs.append(json.loads(fp.read_text(encoding="utf-8")))
                except (json.JSONDecodeError, OSError):
                    continue

    _PACKS = packs
    return packs


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _basename(path: str) -> str:
    return Path(path or "").name.lower()


def apply_knowledge(file_path: str, tags: dict, merged_fields: dict, reasons: list[str]) -> dict:
    """Enhance merged fields from public packs and examples."""
    packs = load_public_packs()
    if not packs:
        return merged_fields

    base = _basename(file_path)
    rel_hint = _norm(file_path.replace("\\", "/"))

    for pack in packs:
        for alias in pack.get("artistAliases") or []:
            if _norm(alias.get("match")) in _norm(tags.get("artist") or "") or _norm(alias.get("match")) in base:
                if alias.get("artist"):
                    merged_fields["artist"] = alias["artist"]
                    reasons.append(f"knowledge: artist alias ({pack.get('_source_file', 'pack')})")

        for hint in pack.get("genreHints") or []:
            pat = hint.get("pattern", "")
            if pat and (pat.lower() in base or pat.lower() in rel_hint):
                if hint.get("genre") and not merged_fields.get("genre"):
                    merged_fields["genre"] = hint["genre"]
                    reasons.append(f"knowledge: genre hint ({pack.get('_source_file', 'pack')})")

        for ex in pack.get("examples") or []:
            ref = ex.get("ref") or {}
            ref_base = _norm(ref.get("basename") or "")
            if ref_base and ref_base == _norm(base):
                after = ex.get("after") or ex.get("suggested") or {}
                for key in ("title", "artist", "album", "genre", "year", "trackNo"):
                    if after.get(key) and not merged_fields.get(key):
                        merged_fields[key] = str(after[key])
                reasons.append("knowledge pack match")
                break

    return merged_fields


def reload_knowledge() -> int:
    """Force reload packs; returns count loaded."""
    global _PACKS
    _PACKS = None
    return len(load_public_packs(force=True))
