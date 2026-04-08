"""Thin backward-compat wrapper — delegates everything to the unified backend service.

bot.py imports from here; the real implementation lives in
backend/services/transcriber_service.py.
"""

from backend.services.transcriber_service import (  # noqa: F401
    transcribe_audio,
    extract_audio,
)

# Re-export WhisperTranscriber class for backward compatibility
class WhisperTranscriber:
    """Wrapper per compatibilità — usa il backend service."""

    def __init__(self, model_name: str = "small", language: str = "it"):
        self.model_name = model_name
        self.language = language

    def transcribe(self, audio_path: str) -> str:
        """Trascrive un file audio. Ritorna il testo o stringa vuota."""
        result = transcribe_audio(audio_path, self.model_name, self.language)
        return result.get("text", "")
