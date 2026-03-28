"""Creator Suite Bot — Gemini helper with caching."""

from __future__ import annotations

from bot.services import gemini_available

_GEMINI_AVAILABLE: bool | None = None


def is_gemini_available() -> bool:
    """Check if Gemini is available (cached)."""
    global _GEMINI_AVAILABLE
    if _GEMINI_AVAILABLE is None:
        _GEMINI_AVAILABLE = gemini_available()
    return _GEMINI_AVAILABLE
