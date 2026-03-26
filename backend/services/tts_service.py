from __future__ import annotations

import logging
import os
import tempfile

logger = logging.getLogger(__name__)

TTS_VOICES = {
    "it": "it-IT-IsabellaNeural",
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "ar": "ar-SA-ZariyahNeural",
}


def get_available_voices() -> dict[str, str]:
    """Return mapping of language code to voice name."""
    return dict(TTS_VOICES)


async def text_to_speech(
    text: str,
    language: str = "it",
    output_path: str | None = None,
) -> str:
    """Convert text to speech using edge-tts.

    Args:
        text: Text to convert.
        language: Language code (e.g. "it", "en").
        output_path: Optional output file path. Auto-generated if None.

    Returns:
        Path to generated audio file (MP3).

    Raises:
        ImportError: If edge-tts is not installed.
        RuntimeError: If TTS generation fails.
    """
    try:
        import edge_tts
    except ImportError:
        logger.error("edge-tts not installed — run: pip install edge-tts")
        raise

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)

    voice = TTS_VOICES.get(language, TTS_VOICES["it"])
    logger.info("TTS: generating speech (%s, voice=%s, %d chars)", language, voice, len(text))

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        logger.info("TTS: completed → %s", output_path)
        return output_path
    except Exception as e:
        logger.error("TTS failed: %s", e)
        raise RuntimeError(f"TTS generation failed: {e}") from e
