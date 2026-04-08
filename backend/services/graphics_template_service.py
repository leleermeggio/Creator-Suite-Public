from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

TEMPLATES = {
    "title_card_minimal": {
        "bg": "#000000",
        "font": "Inter",
        "size": 72,
        "color": "white",
        "anim": "fade",
        "duration": 3.0,
    },
    "title_card_gradient": {
        "bg": "linear",
        "font": "Inter",
        "size": 64,
        "color": "white",
        "gradient_start": "#1a1a2e",
        "gradient_end": "#16213e",
        "duration": 4.0,
    },
    "lower_third_modern": {
        "bg": "rgba(0,0,0,0.7)",
        "font": "Inter",
        "size": 24,
        "color": "white",
        "height_fraction": 0.12,
        "padding": 20,
    },
    "lower_third_neon": {
        "bg": "transparent",
        "font": "Poppins",
        "size": 28,
        "color": "#00ff88",
        "glow": True,
    },
    "text_overlay_shadow": {
        "font": "Montserrat",
        "size": 36,
        "color": "white",
        "shadow": True,
        "shadow_color": "black",
        "shadow_offset": 3,
    },
    "text_overlay_outline": {
        "font": "Inter",
        "size": 32,
        "color": "white",
        "outline": True,
        "outline_color": "black",
        "outline_width": 2,
    },
}


def get_template(name: str) -> dict | None:
    """Get a graphics template by name."""
    return TEMPLATES.get(name)


def list_templates() -> dict[str, dict]:
    """Return all available graphics templates."""
    return dict(TEMPLATES)


def render_title_card(
    text: str,
    template_name: str = "title_card_minimal",
    width: int = 1920,
    height: int = 1080,
    duration: float = 3.0,
    output_path: str | None = None,
) -> str:
    """Render a title card video using FFmpeg.

    Creates a solid color background with centered text.

    Returns:
        Path to rendered title card video (MP4).
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    template = TEMPLATES.get(template_name, TEMPLATES["title_card_minimal"])
    bg = template.get("bg", "#000000")
    _font = template.get("font", "Inter")
    font_size = template.get("size", 72)
    color = template.get("color", "white")

    safe_text = text.replace("'", "\\'").replace(":", "\\:")

    cmd = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        f"color=c={bg}:s={width}x{height}:d={duration}:r=30",
        "-vf",
        (
            f"drawtext=text='{safe_text}':"
            f"fontsize={font_size}:fontcolor={color}:"
            f"x=(w-tw)/2:y=(h-th)/2"
        ),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-y",
        output_path,
    ]

    logger.info("Rendering title card: '%s' (template=%s)", text, template_name)
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def render_lower_third(
    name: str,
    title: str = "",
    template_name: str = "lower_third_modern",
    width: int = 1920,
    height: int = 1080,
    duration: float = 5.0,
    output_path: str | None = None,
) -> str:
    """Render a lower third overlay video with alpha channel.

    Returns:
        Path to rendered lower third video (MOV with alpha, or MP4 fallback).
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    template = TEMPLATES.get(template_name, TEMPLATES["lower_third_modern"])
    font_size = template.get("size", 24)
    color = template.get("color", "white")
    bar_h = int(height * template.get("height_fraction", 0.12))
    padding = template.get("padding", 20)

    safe_name = name.replace("'", "\\'").replace(":", "\\:")

    # Simplified approach — use lavfi directly
    simple_cmd = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        f"color=c=black:s={width}x{height}:d={duration}:r=30",
        "-vf",
        (
            f"drawbox=x=0:y={height - bar_h}:w={width}:h={bar_h}:color=black@0.7:t=fill,"
            f"drawtext=text='{safe_name}':"
            f"fontsize={font_size + 4}:fontcolor={color}:"
            f"x={padding}:y={height - bar_h + 10}"
        ),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-y",
        output_path,
    ]

    logger.info("Rendering lower third: '%s' (template=%s)", name, template_name)
    subprocess.run(simple_cmd, check=True, capture_output=True)
    return output_path
