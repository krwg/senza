"""Glyph MI — Metadata Intelligence for Floke."""

from glyph_mi.analyze import analyze_one, analyze_batch
from glyph_mi.vault import scan_library

__version__ = "0.1.0"
__all__ = ["analyze_one", "analyze_batch", "scan_library", "__version__"]
