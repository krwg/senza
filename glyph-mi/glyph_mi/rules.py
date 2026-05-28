"""Heuristic tag inference (filename, tags, folder, siblings)."""

from __future__ import annotations

import os
import re
from pathlib import Path

from glyph_mi.confidence import build_confidence

UNKNOWN_ARTIST = "Unknown Artist"
UNKNOWN_ALBUM = "Unknown Album"


def split_artists(raw: str) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    parts = re.split(r"\s*(?:,|;| feat\.? | ft\.? | featuring | & )\s*", str(raw), flags=re.I)
    return [p.strip() for p in parts if p.strip()]


def join_artists(names: list[str]) -> str:
    return "; ".join(names)


def basename(file_path: str) -> str:
    return Path(file_path or "").stem


def clean_base(name: str) -> str:
    s = re.sub(r"^\d{1,3}[\s._-]+", "", name or "")
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    s = re.sub(r"\s*\[[^\]]*\]\s*$", "", s)
    return s.strip()


def extract_year(text: str) -> str:
    m = re.search(r"\b(19|20)\d{2}\b", text or "")
    return m.group(0) if m else ""


def extract_track_no(text: str) -> str:
    m = re.match(r"^(\d{1,3})[\s._-]+", text or "")
    return m.group(1) if m else ""


def parse_artist_title(name: str):
    m = re.match(r"^(.+?)\s*[-–—]\s*(.+)$", name or "")
    if not m:
        return None
    return {"artist": m.group(1).strip(), "title": m.group(2).strip()}


def from_filename(file_path: str) -> dict:
    name = basename(file_path)
    reasons: list[str] = []
    parsed = parse_artist_title(name)

    if parsed:
        artists = split_artists(parsed["artist"])
        reasons.append("artist–title filename pattern")
        return {
            "title": clean_base(parsed["title"]) or parsed["title"],
            "artist": join_artists(artists),
            "artists": artists,
            "album": "",
            "genre": "",
            "year": extract_year(name),
            "trackNo": extract_track_no(name),
            "reasons": reasons,
        }

    triple = re.match(r"^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*(.+)$", name)
    if triple:
        artists = split_artists(triple.group(1).strip())
        reasons.append("artist–album–title pattern")
        return {
            "artist": join_artists(artists),
            "artists": artists,
            "album": triple.group(2).strip(),
            "title": clean_base(triple.group(3)) or triple.group(3).strip(),
            "genre": "",
            "year": extract_year(name),
            "trackNo": extract_track_no(name),
            "reasons": reasons,
        }

    track_no = extract_track_no(name)
    cleaned = clean_base(name)
    reasons.append("filename cleanup" if cleaned != name else "filename cleanup only")
    return {
        "title": cleaned or name,
        "artist": "",
        "artists": [],
        "album": "",
        "genre": "",
        "year": extract_year(name),
        "trackNo": track_no,
        "reasons": reasons,
    }


def from_existing_tags(tags: dict) -> dict:
    artists = split_artists(tags.get("artist") or "")
    reasons: list[str] = []
    if tags.get("title"):
        reasons.append("existing title tag")
    if artists:
        reasons.append("existing artist tag")
    if tags.get("album"):
        reasons.append("existing album tag")
    if tags.get("genre"):
        reasons.append("existing genre tag")

    return {
        "title": tags.get("title") or "",
        "artist": join_artists(artists),
        "artists": artists,
        "album": tags.get("album") or "",
        "genre": tags.get("genre") or "",
        "year": str(tags["year"]) if tags.get("year") else "",
        "trackNo": str(tags["trackNo"]) if tags.get("trackNo") else "",
        "reasons": reasons,
    }


def hint_from_path(file_path: str) -> dict | None:
    if not file_path:
        return None
    parts = str(file_path).replace("\\", "/").split("/")
    music_idx = next((i for i, p in enumerate(parts) if p.lower() == "music"), -1)
    if music_idx < 0 or len(parts) < music_idx + 3:
        return None
    artist = parts[music_idx + 1]
    album = parts[music_idx + 2]
    if not artist or not album:
        return None
    artists = split_artists(artist)
    return {
        "artist": join_artists(artists) if artists else artist,
        "artists": artists,
        "album": album,
        "reasons": ["library folder structure"],
    }


def _top_entry(counts: dict[str, int]):
    best = None
    for key, count in counts.items():
        if not best or count > best[1]:
            best = (key, count)
    return best


def consensus_from_siblings(siblings: list[dict] | None) -> dict | None:
    if not siblings:
        return None
    albums: dict[str, int] = {}
    artists: dict[str, int] = {}
    genres: dict[str, int] = {}
    for tr in siblings:
        a = tr.get("album") or ""
        if a and a != UNKNOWN_ALBUM:
            albums[a] = albums.get(a, 0) + 1
        for ar in split_artists(tr.get("artist") or ""):
            if ar and ar != UNKNOWN_ARTIST:
                artists[ar] = artists.get(ar, 0) + 1
        g = tr.get("genre") or ""
        if g:
            genres[g] = genres.get(g, 0) + 1
    top_album = _top_entry(albums)
    top_artist = _top_entry(artists)
    if not top_album and not top_artist:
        return None
    total = len(siblings)
    reasons = []
    if top_album:
        reasons.append(f"album consensus ({top_album[1]}/{total})")
    if top_artist:
        reasons.append(f"artist consensus ({top_artist[1]}/{total})")
    top_genre = _top_entry(genres)
    return {
        "album": top_album[0] if top_album else "",
        "artist": top_artist[0] if top_artist else "",
        "artists": [top_artist[0]] if top_artist else [],
        "genre": top_genre[0] if top_genre else "",
        "reasons": reasons,
    }


def merge_fields(*sources: dict | None) -> dict:
    out = {
        "title": "",
        "artist": "",
        "artists": [],
        "album": "",
        "genre": "",
        "year": "",
        "trackNo": "",
    }
    reasons: list[str] = []

    for src in sources:
        if not src:
            continue
        if not out["title"] and src.get("title"):
            out["title"] = src["title"]
        if not out["artist"] and src.get("artist"):
            out["artist"] = src["artist"]
            out["artists"] = src.get("artists") or split_artists(src["artist"])
        if not out["album"] and src.get("album"):
            out["album"] = src["album"]
        if not out["genre"] and src.get("genre"):
            out["genre"] = src["genre"]
        if not out["year"] and src.get("year"):
            out["year"] = src["year"]
        if not out["trackNo"] and src.get("trackNo"):
            out["trackNo"] = src["trackNo"]
        reasons.extend(src.get("reasons") or [])

    out["reasons"] = reasons
    return out


def analyze_rules(file_path: str, tags: dict, context: dict) -> dict:
    from_file = from_filename(file_path)
    from_tags = from_existing_tags(tags)
    folder = hint_from_path(file_path)
    folder_hint = None
    if context.get("folderHint"):
        folder_hint = {"album": context["folderHint"], "artist": "", "reasons": ["folder hint"]}
    siblings = consensus_from_siblings(context.get("siblingTracks"))

    merged = merge_fields(from_file, from_tags, folder, folder_hint, siblings)
    confidence = build_confidence(merged["reasons"], merged)

    return {
        "fields": {
            "title": merged["title"],
            "artist": merged["artist"],
            "artists": merged["artists"],
            "album": merged["album"],
            "genre": merged["genre"],
            "year": merged["year"],
            "trackNo": merged["trackNo"],
        },
        "confidence": confidence,
        "sources": ["glyph-rules"],
        "provider": "glyph-rules",
        "hints": [{"field": "*", "message": r} for r in merged["reasons"]],
    }
