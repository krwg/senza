"""Glyph MI analyze API."""

from __future__ import annotations

from glyph_mi.confidence import build_confidence
from glyph_mi.knowledge import apply_knowledge
from glyph_mi.rules import analyze_rules, merge_fields, split_artists


def analyze_one(inp: dict) -> dict:
    """
    Analyze a single track.

    inp: { filePath, tags?, context? }
    returns: { fields, confidence, provider, sources, hints }
    """
    file_path = inp.get("filePath") or ""
    tags = inp.get("tags") or {}
    context = inp.get("context") or {}

    base = analyze_rules(file_path, tags, context)
    merged = dict(base["fields"])
    reasons = list(base["confidence"].get("reasons") or [])

    merged = apply_knowledge(file_path, tags, merged, reasons)
    if not merged.get("artists") and merged.get("artist"):
        merged["artists"] = split_artists(merged["artist"])

    confidence = build_confidence(reasons, merged)
    sources = list(base.get("sources") or ["glyph-rules"])
    if any("knowledge" in r for r in reasons):
        if "glyph-knowledge" not in sources:
            sources.append("glyph-knowledge")

    return {
        "fields": {
            "title": merged.get("title") or "",
            "artist": merged.get("artist") or "",
            "artists": merged.get("artists") or [],
            "album": merged.get("album") or "",
            "genre": merged.get("genre") or "",
            "year": merged.get("year") or "",
            "trackNo": merged.get("trackNo") or "",
        },
        "confidence": confidence,
        "sources": sources,
        "provider": "glyph-mi",
        "hints": [{"field": "*", "message": r} for r in reasons[:12]],
    }


def analyze_batch(items: list[dict]) -> list[dict]:
    return [analyze_one(item) for item in items]
