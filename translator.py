"""Servizio di traduzione testo tramite Google Translate (deep-translator)."""

from __future__ import annotations

import logging

from deep_translator import GoogleTranslator

logger = logging.getLogger("bot.translator")

# Lingue supportate — {codice: (flag_emoji, nome)}
LANGUAGES: dict[str, tuple[str, str]] = {
    "en": ("🇬🇧", "English"),
    "it": ("🇮🇹", "Italiano"),
    "es": ("🇪🇸", "Español"),
    "fr": ("🇫🇷", "Français"),
    "de": ("🇩🇪", "Deutsch"),
    "pt": ("🇵🇹", "Português"),
    "zh-CN": ("🇨🇳", "中文"),
    "ja": ("🇯🇵", "日本語"),
    "ko": ("🇰🇷", "한국어"),
    "ru": ("🇷🇺", "Русский"),
    "ar": ("🇸🇦", "العربية"),
}

# Limite caratteri per singola richiesta Google Translate
_CHUNK_LIMIT = 4900


def translate_text(text: str, target_lang: str) -> str:
    """Traduce il testo nella lingua di destinazione.

    Gestisce automaticamente testi lunghi splittandoli in chunk.
    Ritorna il testo tradotto o stringa vuota in caso di errore.
    """
    if not text.strip():
        return ""

    flag, name = LANGUAGES.get(target_lang, ("🌍", target_lang))
    logger.info("🌍 Traduzione → %s %s (%d caratteri)", flag, name, len(text))

    try:
        translator = GoogleTranslator(source="auto", target=target_lang)

        if len(text) <= _CHUNK_LIMIT:
            result = translator.translate(text)
            logger.info("✅ Traduzione completata — %d caratteri", len(result or ""))
            return result or ""

        # Testo lungo: split in chunk
        chunks = _split_for_translation(text)
        logger.info("📦 Testo lungo — diviso in %d chunk", len(chunks))

        translated_parts = []
        for i, chunk in enumerate(chunks, 1):
            result = translator.translate(chunk)
            translated_parts.append(result or "")
            logger.info("   ✅ Chunk %d/%d tradotto", i, len(chunks))

        full = " ".join(translated_parts)
        logger.info("✅ Traduzione completa — %d caratteri totali", len(full))
        return full

    except Exception as e:
        logger.exception("❌ Errore traduzione: %s", e)
        return ""


def _split_for_translation(text: str) -> list[str]:
    """Divide il testo in chunk rispettando i limiti di Google Translate."""
    chunks: list[str] = []
    remaining = text

    while remaining:
        if len(remaining) <= _CHUNK_LIMIT:
            chunks.append(remaining)
            break

        # Cerca un punto di split naturale (fine frase)
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
