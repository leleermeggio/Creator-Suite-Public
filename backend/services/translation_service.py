from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "en": "English",
    "it": "Italiano",
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
    "pt": "Português",
    "zh-CN": "中文",
    "ja": "日本語",
    "ko": "한국어",
    "ru": "Русский",
    "ar": "العربية",
}

_CHUNK_LIMIT = 4900


def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text to target language using deep-translator (Google Translate).

    Handles long texts by splitting into chunks automatically.

    Args:
        text: Text to translate.
        target_lang: Target language code (e.g. "en", "it").
        source_lang: Source language code or "auto" for detection.

    Returns:
        Translated text. Empty string on failure.
    """
    if not text.strip():
        return ""

    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        logger.error("deep-translator not installed — run: pip install deep-translator")
        raise

    logger.info("Translating %d chars → %s", len(text), target_lang)

    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)

        if len(text) <= _CHUNK_LIMIT:
            result = translator.translate(text)
            return result or ""

        chunks = _split_for_translation(text)
        logger.info("Long text — split into %d chunks", len(chunks))

        translated_parts = []
        for i, chunk in enumerate(chunks, 1):
            result = translator.translate(chunk)
            translated_parts.append(result or "")

        return " ".join(translated_parts)

    except Exception as e:
        logger.exception("Translation failed: %s", e)
        return ""


def translate_segments(
    segments: list[dict],
    target_lang: str,
    source_lang: str = "auto",
) -> list[dict]:
    """Translate caption segments preserving timing.

    Args:
        segments: List of {start, end, text, words?}
        target_lang: Target language code.
        source_lang: Source language or "auto".

    Returns:
        New list of segments with translated text (timing preserved).
    """
    translated = []
    for seg in segments:
        new_seg = dict(seg)
        new_seg["text"] = translate_text(seg.get("text", ""), target_lang, source_lang)
        if "words" in new_seg:
            del new_seg["words"]  # Word-level timing invalid after translation
        translated.append(new_seg)
    return translated


def _split_for_translation(text: str) -> list[str]:
    """Split text into chunks respecting Google Translate limits."""
    chunks: list[str] = []
    remaining = text

    while remaining:
        if len(remaining) <= _CHUNK_LIMIT:
            chunks.append(remaining)
            break

        split_at = remaining.rfind(". ", 0, _CHUNK_LIMIT)
        if split_at == -1:
            split_at = remaining.rfind(" ", 0, _CHUNK_LIMIT)
        if split_at == -1:
            split_at = _CHUNK_LIMIT
        else:
            split_at += 1

        chunks.append(remaining[:split_at])
        remaining = remaining[split_at:].lstrip()

    return chunks
