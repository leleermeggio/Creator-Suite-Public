from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable

import requests

logger = logging.getLogger(__name__)


class GeminiError(Exception):
    """Base exception for Gemini service errors."""

    pass


class GeminiRateLimitError(GeminiError):
    """Raised when rate limit (429) is encountered."""

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class GeminiTimeoutError(GeminiError):
    """Raised when a request times out."""

    pass


_model = None

API_TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
BASE_BACKOFF_MS = 1000
RATE_LIMIT_BACKOFF_MS = 60000


def _retry_with_backoff(func: Callable[[], Any], is_rate_limit: bool = False) -> Any:
    """Execute function with retry logic and exponential backoff.

    Args:
        func: Function to execute (should make API call).
        is_rate_limit: If True, use longer backoff for rate limit recovery.

    Returns:
        Result of func on success.

    Raises:
        GeminiError: On failure after all retries exhausted.
        GeminiRateLimitError: On rate limit error.
        GeminiTimeoutError: On timeout.
    """
    backoff_ms = RATE_LIMIT_BACKOFF_MS if is_rate_limit else BASE_BACKOFF_MS

    for attempt in range(MAX_RETRIES):
        try:
            return func()
        except requests.exceptions.Timeout:
            logger.warning(
                "Gemini request timeout (attempt %d/%d)", attempt + 1, MAX_RETRIES
            )
            if attempt == MAX_RETRIES - 1:
                raise GeminiTimeoutError(
                    f"Request timed out after {MAX_RETRIES} attempts"
                )
            time.sleep(backoff_ms / 1000)
        except requests.exceptions.HTTPError as http_err:
            response = getattr(http_err, "response", None)
            if response and response.status_code == 429:
                retry_after = int(
                    response.headers.get("Retry-After", backoff_ms // 1000)
                )
                logger.warning(
                    "Gemini rate limited (attempt %d/%d), retry after %ds",
                    attempt + 1,
                    MAX_RETRIES,
                    retry_after,
                )
                if attempt == MAX_RETRIES - 1:
                    raise GeminiRateLimitError("Rate limit exceeded", retry_after)
                time.sleep(retry_after)
            else:
                logger.error("Gemini HTTP error: %s", http_err)
                raise GeminiError(str(http_err))
        except Exception as e:
            logger.warning(
                "Gemini error (attempt %d/%d): %s", attempt + 1, MAX_RETRIES, e
            )
            if attempt == MAX_RETRIES - 1:
                raise GeminiError(str(e))
            time.sleep(backoff_ms * (2**attempt) / 1000)  # Exponential backoff

    raise GeminiError("All retries exhausted")


def _get_model():
    global _model
    if _model is not None:
        return _model

    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-2.0-flash")
        return _model
    except Exception as e:
        logger.error("Gemini init failed: %s", e)
        return None


def gemini_available() -> bool:
    return bool(os.getenv("GOOGLE_API_KEY", ""))


def summarize_text(text: str, language: str | None = None) -> str | None:
    """Summarize text using Gemini AI.

    Args:
        text: Text to summarize.
        language: Optional language hint. If None, responds in same language as input.

    Returns:
        Summary text or None if Gemini unavailable.
    """
    model = _get_model()
    if not model:
        return None

    lang_hint = (
        f" Respond in {language}."
        if language
        else " Respond in the same language as the input."
    )

    try:
        response = _retry_with_backoff(
            lambda: model.generate_content(
                "Summarize the following text clearly and concisely. "
                "Use bullet points where appropriate." + lang_hint + "\n\n" + text,
                request_options={"timeout": API_TIMEOUT_SECONDS},
            )
        )
        return response.text
    except (GeminiError, GeminiRateLimitError, GeminiTimeoutError) as e:
        logger.error("Gemini summarize failed: %s", e)
        return None


def ocr_image(image_path: str) -> str | None:
    """Extract text from image using Gemini vision.

    Args:
        image_path: Path to image file.

    Returns:
        Extracted text or None if Gemini unavailable.
    """
    model = _get_model()
    if not model:
        return None

    try:
        import PIL.Image

        img = PIL.Image.open(image_path)
        response = _retry_with_backoff(
            lambda: model.generate_content(
                [
                    "Extract all visible text from this image. "
                    "Return ONLY the extracted text, no comments or explanations.",
                    img,
                ],
                request_options={"timeout": API_TIMEOUT_SECONDS},
            )
        )
        return response.text
    except (GeminiError, GeminiRateLimitError, GeminiTimeoutError) as e:
        logger.error("Gemini OCR failed: %s", e)
        return None


def analyze_video_frame(image_path: str, prompt: str) -> str | None:
    """Analyze a video frame with a custom prompt using Gemini vision.

    Args:
        image_path: Path to frame image.
        prompt: Analysis prompt.

    Returns:
        Analysis text or None if Gemini unavailable.
    """
    model = _get_model()
    if not model:
        return None

    try:
        import PIL.Image

        img = PIL.Image.open(image_path)
        response = _retry_with_backoff(
            lambda: model.generate_content(
                [prompt, img], request_options={"timeout": API_TIMEOUT_SECONDS}
            )
        )
        return response.text
    except (GeminiError, GeminiRateLimitError, GeminiTimeoutError) as e:
        logger.error("Gemini frame analysis failed: %s", e)
        return None
