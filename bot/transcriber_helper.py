"""Creator Suite Bot — Transcriber helper with lazy loading."""

from __future__ import annotations

from bot.config import WHISPER_MODEL, TRANSCRIBE_LANGUAGE
from bot.transcriber import WhisperTranscriber

_transcriber: WhisperTranscriber | None = None


def get_transcriber() -> WhisperTranscriber:
    """Get or create the transcriber instance (lazy loading)."""
    global _transcriber
    if _transcriber is None:
        _transcriber = WhisperTranscriber(WHISPER_MODEL, TRANSCRIBE_LANGUAGE)
    return _transcriber
