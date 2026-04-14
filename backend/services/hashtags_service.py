from __future__ import annotations

import logging
import os
import re

from backend.services.gemini_service import (
    generate_hashtags as gemini_generate_hashtags,
)

logger = logging.getLogger(__name__)


async def generate(text: str, max_count: int, language: str) -> str:
    """Generate hashtags for the given text using either Gemini or a deterministic fallback.

    Args:
        text: Input text to generate hashtags from
        max_count: Maximum number of hashtags (1-30)
        language: Language code (e.g., 'en', 'it')

    Returns:
        Comma-separated string of hashtags (e.g., "#tag1, #tag2, #tag3")

    Raises:
        Exception: Re-raises any exceptions from Gemini service
    """
    logger.info(
        "🚀 Starting hashtag generation for text: %s",
        text[:50] + "..." if len(text) > 50 else text,
    )

    # Clamp max_count to valid range
    max_count = max(1, min(max_count, 30))

    # Check if we have a Google API key
    google_api_key = os.getenv("GOOGLE_API_KEY")

    if google_api_key:
        logger.info("✅ Using Gemini for hashtag generation")
        try:
            hashtags = await gemini_generate_hashtags(text, max_count, language)
            logger.info("✅ Gemini hashtag generation completed successfully")
            return hashtags
        except Exception as e:
            logger.error("❌ Error in Gemini hashtag generation: %s", str(e))
            raise  # Re-raise to let route handle it
    else:
        logger.warning("⚠️  No GOOGLE_API_KEY found, using deterministic fallback")
        hashtags = _generate_hashtags_fallback(text, max_count, language)
        logger.info("✅ Deterministic hashtag generation completed")
        return hashtags


def _generate_hashtags_fallback(text: str, max_count: int, language: str) -> str:
    """Generate hashtags deterministically from text.

    Args:
        text: Input text
        max_count: Maximum number of hashtags to generate
        language: Language code for stop-word filtering

    Returns:
        Comma-separated string of hashtags
    """
    # Tokenize on whitespace and punctuation
    tokens = re.findall(r"\b\w+\b", text)

    # Convert to lowercase
    tokens = [token.lower() for token in tokens]

    # Remove stop words (Italian + English)
    stop_words = {
        "en": {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "must",
            "can",
        },
        "it": {
            "il",
            "lo",
            "la",
            "i",
            "gli",
            "le",
            "un",
            "uno",
            "una",
            "e",
            "o",
            "ma",
            "in",
            "su",
            "da",
            "per",
            "di",
            "con",
            "by",
            "è",
            "sono",
            "era",
            "erano",
            "essere",
            "avere",
            "ha",
            "hanno",
            "fai",
            "fa",
            "fanno",
            "fare",
            "farei",
            "faresti",
            "farebbe",
            "farebbero",
            "potere",
            "può",
            "posso",
            "possiamo",
            "potete",
            "potrebbero",
            "dovere",
            "deve",
            "devono",
            "dovrebbe",
            "dovrebbero",
            "sapere",
            "so",
            "sappiamo",
            "sai",
            "sanno",
            "saperlo",
            "saperne",
            "saperne",
        },
    }

    # Get stop words for the language or default to English
    lang_stop_words = stop_words.get(language, stop_words["en"])

    # Remove stop words and deduplicate while preserving order
    seen = set()
    filtered_tokens: list[str] = []
    for token in tokens:
        if token not in lang_stop_words and token not in seen:
            filtered_tokens.append(token)
            seen.add(token)

    # Take first max_count tokens
    selected_tokens = filtered_tokens[:max_count]

    # Prefix with #
    hashtags = [f"#{token}" for token in selected_tokens]

    return ", ".join(hashtags)
