"""Creator Suite Bot — Transcriber helper with lazy loading."""

from __future__ import annotations

from bot.config import WHISPER_MODEL, TRANSCRIBE_LANGUAGE

try:
    from bot.transcriber import WhisperTranscriber
    TRANSCRIBER_AVAILABLE = True
except ImportError:
    WhisperTranscriber = None  # type: ignore
    TRANSCRIBER_AVAILABLE = False

_transcriber: "WhisperTranscriber | None" = None


def get_transcriber() -> "WhisperTranscriber":
    """Get or create the transcriber instance (lazy loading)."""
    global _transcriber
    if not TRANSCRIBER_AVAILABLE:
        raise RuntimeError("Whisper non disponibile. Installa torch e openai-whisper.")
    if _transcriber is None:
        _transcriber = WhisperTranscriber(WHISPER_MODEL, TRANSCRIBE_LANGUAGE)
    return _transcriber
