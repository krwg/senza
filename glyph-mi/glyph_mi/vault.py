"""Library-wide scan for Music Vault."""

from __future__ import annotations

from glyph_mi.analyze import analyze_one

UNKNOWN_ARTIST = "Unknown Artist"
UNKNOWN_ALBUM = "Unknown Album"


def _needs_attention(tr: dict) -> bool:
    if not str(tr.get("title") or "").strip():
        return True
    artist = tr.get("artist") or ""
    if not artist or artist == UNKNOWN_ARTIST:
        return True
    album = tr.get("album") or ""
    if not album or album == UNKNOWN_ALBUM:
        return True
    return False


def _track_input(tr: dict, all_tracks: list[dict]) -> dict:
    siblings = [
        t
        for t in all_tracks
        if t.get("id") != tr.get("id")
        and t.get("album") == tr.get("album")
        and t.get("artist") == tr.get("artist")
    ]
    return {
        "filePath": tr.get("path") or "",
        "tags": tr,
        "context": {"siblingTracks": siblings, "folderHint": tr.get("album") or ""},
    }


def scan_library(tracks: list[dict], *, max_fix_preview: int = 12) -> dict:
    """
    Scan library health and Glyph fix opportunities.

    tracks: Senza track objects (id, path, title, artist, album, genre, year, hasCover, ...)
    """
    total = len(tracks)
    if not total:
        return {
            "total": 0,
            "score": 0,
            "tagPct": 0,
            "coverPct": 0,
            "needsAttention": 0,
            "glyphCanHelp": 0,
            "insights": [],
            "fixPreviews": [],
            "provider": "glyph-mi",
        }

    attention = [t for t in tracks if _needs_attention(t)]
    with_cover = sum(1 for t in tracks if t.get("hasCover"))
    with_tags = sum(
        1
        for t in tracks
        if t.get("title") and t.get("artist") and t.get("artist") != UNKNOWN_ARTIST
    )

    tag_pct = round((with_tags / total) * 100)
    cover_pct = round((with_cover / total) * 100)
    att_pct = len(attention) / total
    score = min(100, round(tag_pct * 0.5 + cover_pct * 0.3 + (100 - att_pct * 100) * 0.2))

    fix_previews = []
    glyph_can_help = 0

    for tr in attention[: max_fix_preview * 3]:
        try:
            result = analyze_one(_track_input(tr, tracks))
            fields = result.get("fields") or {}
            conf = result.get("confidence") or {}
            if conf.get("level") in ("high", "medium") and fields.get("title"):
                glyph_can_help += 1
                if len(fix_previews) < max_fix_preview:
                    fix_previews.append(
                        {
                            "trackId": tr.get("id"),
                            "basename": (tr.get("path") or "").split("/")[-1].split("\\")[-1],
                            "before": {
                                "title": tr.get("title"),
                                "artist": tr.get("artist"),
                                "album": tr.get("album"),
                            },
                            "suggested": fields,
                            "confidence": conf,
                        }
                    )
        except Exception:
            continue

    insights = []
    if attention:
        insights.append(
            {
                "key": "attention",
                "severity": "warn",
                "message": f"{len(attention)} tracks need tag attention",
            }
        )
    if glyph_can_help:
        insights.append(
            {
                "key": "glyph_fix",
                "severity": "info",
                "message": f"Glyph can suggest fixes for {glyph_can_help}+ tracks",
            }
        )
    if tag_pct < 80:
        insights.append(
            {
                "key": "tags_low",
                "severity": "warn",
                "message": f"Only {tag_pct}% of tracks have complete basic tags",
            }
        )
    if cover_pct < 70:
        insights.append(
            {
                "key": "covers_low",
                "severity": "info",
                "message": f"{cover_pct}% tracks have cover art",
            }
        )

    artists = set()
    for t in tracks:
        for a in (t.get("artist") or "").split(";"):
            a = a.strip()
            if a and a != UNKNOWN_ARTIST:
                artists.add(a)

    return {
        "total": total,
        "artists": len(artists),
        "albums": len({f"{t.get('artist')}::{t.get('album')}" for t in tracks}),
        "score": score,
        "tagPct": tag_pct,
        "coverPct": cover_pct,
        "needsAttention": len(attention),
        "missingCovers": total - with_cover,
        "glyphCanHelp": glyph_can_help,
        "insights": insights,
        "fixPreviews": fix_previews,
        "provider": "glyph-mi",
    }
