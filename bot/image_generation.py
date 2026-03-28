"""Image generation service using NanoBanana API."""

from __future__ import annotations

import base64
import logging
import os
from io import BytesIO

import httpx
from PIL import Image

logger = logging.getLogger("bot.image_generation")

NANOBANANA_API_URL = "https://www.nananobanana.com/api/v1/generate"
DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1024
DEFAULT_MODEL = "nano-banana"


async def generate_image_nanobanana(
    prompt: str,
    api_key: str,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    model: str = DEFAULT_MODEL,
) -> bytes:
    """Generate image using NanoBanana API.

    Args:
        prompt: Image description/prompt
        api_key: NanoBanana API key
        width: Image width (default 1024)
        height: Image height (default 1024)
        model: Model name (default "nano-banana")

    Returns:
        Raw image bytes (PNG)

    Raises:
        RuntimeError: If generation fails
    """
    # Map dimensions to aspect ratio
    aspect_ratio = "1:1"  # default
    if width == 1024 and height == 1536:
        aspect_ratio = "2:3"
    elif width == 1536 and height == 1024:
        aspect_ratio = "3:2"

    payload = {
        "prompt": prompt,
        "selectedModel": model,
        "aspectRatio": aspect_ratio,
        "mode": "sync",
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            logger.info("🎨 Generating image with NanoBanana: %s (%s)", prompt[:50], aspect_ratio)
            
            # Generate image
            resp = await client.post(NANOBANANA_API_URL, json=payload, headers=headers, timeout=90.0)
            resp.raise_for_status()
            data = resp.json()

            # Get image URL from response
            output_urls = data.get("data", {}).get("outputImageUrls", [])
            if not output_urls:
                raise RuntimeError("NanoBanana returned no image URLs")

            image_url = output_urls[0]
            logger.info("✅ Image generated, downloading from: %s", image_url[:60])

            # Download image
            img_resp = await client.get(image_url, timeout=30.0)
            img_resp.raise_for_status()
            
            logger.info("✅ Image downloaded: %d bytes", len(img_resp.content))
            return img_resp.content

        except httpx.HTTPStatusError as e:
            error_msg = f"NanoBanana API error: {e.response.status_code}"
            try:
                error_detail = e.response.text[:200]
                if error_detail:
                    error_msg += f" - {error_detail}"
            except Exception:
                pass
            logger.error("❌ %s", error_msg)
            raise RuntimeError(error_msg) from e
        except httpx.TimeoutException as e:
            logger.error("❌ NanoBanana timeout")
            raise RuntimeError("Image generation timed out. Try again.") from e
        except Exception as e:
            logger.error("❌ Image generation failed: %s", e)
            raise RuntimeError(f"Image generation failed: {e}") from e


def validate_image_size(width: int, height: int) -> tuple[int, int]:
    """Validate and clamp image dimensions."""
    # NanoBanana supports: 1024x1024, 1024x1536, 1536x1024
    valid_sizes = [(1024, 1024), (1024, 1536), (1536, 1024)]

    # Find closest valid size
    best_match = (1024, 1024)
    min_diff = float("inf")

    for vw, vh in valid_sizes:
        diff = abs(vw - width) + abs(vh - height)
        if diff < min_diff:
            min_diff = diff
            best_match = (vw, vh)

    return best_match
