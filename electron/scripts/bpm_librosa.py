#!/usr/bin/env python3
"""Optional BPM via librosa — used when Python + librosa are installed."""
from __future__ import annotations

import sys


def main() -> int:
    if len(sys.argv) < 2:
        return 1
    path = sys.argv[1]
    try:
        import librosa
        import numpy as np
    except ImportError:
        return 2
    try:
        y, sr = librosa.load(path, duration=45.0, mono=True)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])
        if 40 <= bpm <= 240:
            print(int(round(bpm)))
            return 0
    except Exception:
        return 3
    return 4


if __name__ == "__main__":
    raise SystemExit(main())
