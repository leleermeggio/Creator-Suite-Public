from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_model = None


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
        response = model.generate_content(
            "Summarize the following text clearly and concisely. "
            "Use bullet points where appropriate." + lang_hint + "\n\n" + text
        )
        return response.text
    except Exception as e:
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
        response = model.generate_content(
            [
                "Extract all visible text from this image. "
                "Return ONLY the extracted text, no comments or explanations.",
                img,
            ]
        )
        return response.text
    except Exception as e:
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
        response = model.generate_content([prompt, img])
        return response.text
    except Exception as e:
        logger.error("Gemini frame analysis failed: %s", e)
        return None
