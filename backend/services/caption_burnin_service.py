from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# Style presets for caption rendering
STYLE_PRESETS = {
    "default": {
        "fontname": "Inter",
        "fontsize": 24,
        "primary_color": "&HFFFFFF&",
        "outline_color": "&H000000&",
        "back_color": "&H80000000&",
        "outline": 2,
        "shadow": 1,
        "alignment": 2,  # bottom-center
        "margin_v": 40,
    },
    "bold_center": {
        "fontname": "Inter",
        "fontsize": 32,
        "primary_color": "&HFFFFFF&",
        "outline_color": "&H000000&",
        "back_color": "&H80000000&",
        "outline": 3,
        "shadow": 2,
        "alignment": 5,  # center
        "margin_v": 0,
    },
    "tiktok": {
        "fontname": "Inter",
        "fontsize": 28,
        "primary_color": "&HFFFFFF&",
        "outline_color": "&H000000&",
        "back_color": "&H00000000&",
        "outline": 3,
        "shadow": 0,
        "alignment": 5,
        "margin_v": 0,
    },
    "youtube": {
        "fontname": "Inter",
        "fontsize": 22,
        "primary_color": "&HFFFFFF&",
        "outline_color": "&H000000&",
        "back_color": "&HB4000000&",
        "outline": 1,
        "shadow": 1,
        "alignment": 2,
        "margin_v": 30,
    },
    "minimal": {
        "fontname": "Inter",
        "fontsize": 20,
        "primary_color": "&HFFFFFF&",
        "outline_color": "&H40000000&",
        "back_color": "&H00000000&",
        "outline": 1,
        "shadow": 0,
        "alignment": 2,
        "margin_v": 20,
    },
}


def _hex_to_ass_color(hex_color: str) -> str:
    """Convert hex color (#RRGGBB or #AARRGGBB) to ASS format (&HBBGGRR& or &HAABBGGRR&)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        return f"&H{b}{g}{r}&"
    elif len(hex_color) == 8:
        a, r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6], hex_color[6:8]
        return f"&H{a}{b}{g}{r}&"
    return "&HFFFFFF&"


def generate_ass_subtitle(
    segments: list[dict],
    style_preset: str = "default",
    font_family: str | None = None,
    font_size: int | None = None,
    color: str | None = None,
    bg_color: str | None = None,
    position: str | None = None,
) -> str:
    """Generate ASS subtitle content from caption segments.

    Args:
        segments: List of {start, end, text} dicts.
        style_preset: Preset name from STYLE_PRESETS.
        font_family: Override preset font.
        font_size: Override preset font size.
        color: Override primary color (hex #RRGGBB).
        bg_color: Override background color (hex or rgba).
        position: "top", "center", or "bottom".

    Returns:
        ASS subtitle file content as string.
    """
    preset = STYLE_PRESETS.get(style_preset, STYLE_PRESETS["default"]).copy()

    if font_family:
        preset["fontname"] = font_family
    if font_size:
        preset["fontsize"] = font_size
    if color:
        preset["primary_color"] = _hex_to_ass_color(color)
    if bg_color and bg_color.startswith("#"):
        preset["back_color"] = _hex_to_ass_color(bg_color)

    if position == "top":
        preset["alignment"] = 8
        preset["margin_v"] = 30
    elif position == "center":
        preset["alignment"] = 5
        preset["margin_v"] = 0
    elif position == "bottom":
        preset["alignment"] = 2
        preset["margin_v"] = 40

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{preset['fontname']},{preset['fontsize']},{preset['primary_color']},"
        f"&H000000FF&,{preset['outline_color']},{preset['back_color']},"
        f"-1,0,0,0,100,100,0,0,1,{preset['outline']},{preset['shadow']},"
        f"{preset['alignment']},10,10,{preset['margin_v']},1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    events = []
    for seg in segments:
        start = _seconds_to_ass_time(seg.get("start", 0))
        end = _seconds_to_ass_time(seg.get("end", 0))
        text = seg.get("text", "").replace("\n", "\\N")
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.cc)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def burn_captions(
    video_path: str,
    segments: list[dict],
    style_preset: str = "default",
    output_path: str | None = None,
    **style_overrides,
) -> str:
    """Burn captions into video using FFmpeg ASS subtitle filter.

    Args:
        video_path: Path to source video.
        segments: List of {start, end, text} dicts.
        style_preset: Preset name.
        output_path: Optional output path. Auto-generated if None.
        **style_overrides: font_family, font_size, color, bg_color, position.

    Returns:
        Path to output video with burned-in captions.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    ass_content = generate_ass_subtitle(segments, style_preset, **style_overrides)

    fd, ass_path = tempfile.mkstemp(suffix=".ass")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(ass_content)

        cmd = [
            "ffmpeg",
            "-i",
            video_path,
            "-vf",
            f"ass={ass_path}",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "copy",
            "-y",
            output_path,
        ]
        logger.info("Burning captions into video: %s", video_path)
        subprocess.run(cmd, check=True, capture_output=True)
    finally:
        os.unlink(ass_path)

    return output_path
