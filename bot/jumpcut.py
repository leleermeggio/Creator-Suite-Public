"""Thin backward-compat wrapper — delegates everything to the unified backend service.

bot.py imports from here; the real implementation lives in
backend/services/jumpcut_service.py.
"""

from backend.services.jumpcut_service import (  # noqa: F401
    JumpCutResult,
    check_ffmpeg,
    process_jumpcut,
)
