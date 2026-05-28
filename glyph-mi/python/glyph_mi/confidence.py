"""Confidence scoring for tag suggestions."""


def build_confidence(reasons: list[str], fields: dict) -> dict:
    score = 0
    unique = list(dict.fromkeys(reasons))

    weights = {
        "artist–title filename pattern": 35,
        "artist–album–title pattern": 40,
        "existing artist tag": 25,
        "existing title tag": 20,
        "existing album tag": 15,
        "folder structure": 20,
        "folder hint": 12,
        "album consensus": 30,
        "knowledge pack match": 28,
        "knowledge:": 22,
    }

    for r in unique:
        for key, w in weights.items():
            if key in r:
                score += w
                break
        else:
            if "cleanup" in r:
                score += 8

    filled = sum(1 for k in ("title", "artist", "album") if fields.get(k))
    score += filled * 8
    score = min(100, score)

    if score >= 75:
        level = "high"
    elif score >= 45:
        level = "medium"
    else:
        level = "low"

    return {"score": score, "level": level, "reasons": unique[:12]}
