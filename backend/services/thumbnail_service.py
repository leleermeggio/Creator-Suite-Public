from __future__ import annotations

import io
import logging
from typing import Optional

import requests
from PIL import Image

from backend.services.thumbnail_templates import ThumbnailContext, get_template

logger = logging.getLogger(__name__)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"

_TEMPLATE_PROMPTS: dict[str, str] = {
    "impact": "dramatic cinematic scene, vibrant colors, dynamic lighting, no text, no watermark, photorealistic, 4k",
    "split": "dark moody background, professional atmosphere, gradient dark, no faces, no text, studio lighting",
    "gradient-bar": "wide landscape scene, golden hour light, cinematic, no text, high contrast, atmospheric",
    "bold-side": "abstract background texture, bokeh, dark right side, no text, professional photography",
    "minimal": "subtle texture background, dark gradient, minimalist, no text, abstract pattern",
    "reaction": "dramatic background, expressive scene, no text, cinematic wide shot, vivid colors",
    "neon": "dark cyberpunk cityscape, neon lights reflection, dark background, sci-fi, no text",
    "cinematic": "cinematic widescreen landscape, dramatic sky, golden hour, no text, epic scene, film grain",
}


def _build_pollinations_url(
    template_id: str, title: str, w: int = 1280, h: int = 720
) -> str:
    style = _TEMPLATE_PROMPTS.get(template_id, _TEMPLATE_PROMPTS["impact"])
    # Inject topic keywords from title for more relevant backgrounds
    topic_words = " ".join(title.split()[:4]).lower()
    full_prompt = f"{topic_words}, {style}"
    encoded = requests.utils.quote(full_prompt)
    return f"{POLLINATIONS_BASE}/{encoded}?width={w}&height={h}&nologo=true&seed=42"


def _fetch_background(url: str) -> Image.Image:
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        logger.warning("Pollinations fetch failed (%s) — using solid fallback", e)
        return Image.new("RGB", (1280, 720), (15, 10, 30))


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _decode_photo(b64: str) -> Optional[Image.Image]:
    if not b64:
        return None
    import base64

    try:
        data = base64.b64decode(b64)
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        logger.warning("Subject photo decode failed: %s", e)
        return None


def generate_thumbnail(
    template_id: str,
    title: str,
    subtitle: Optional[str],
    accent_color: str,
    subject_photo_b64: Optional[str],
) -> bytes:
    """Fetch Pollinations background, composite with Pillow, return PNG bytes."""
    url = _build_pollinations_url(template_id, title)
    bg = _fetch_background(url)

    ctx = ThumbnailContext(
        title=title,
        subtitle=subtitle,
        accent_color=_hex_to_rgb(accent_color),
        subject_photo=_decode_photo(subject_photo_b64) if subject_photo_b64 else None,
    )

    template = get_template(template_id)
    result = template.compose(bg, ctx)

    # Cap output size
    if result.size != (1280, 720):
        result = result.resize((1280, 720), Image.LANCZOS)

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
