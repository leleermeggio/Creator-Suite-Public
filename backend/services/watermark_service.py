from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def add_watermark(
    video_path: str,
    watermark_path: str,
    position: str = "bottom_right",
    opacity: float = 0.5,
    scale: float = 0.15,
    output_path: str | None = None,
) -> str:
    """Add image watermark overlay to video using FFmpeg.

    Args:
        video_path: Path to source video.
        watermark_path: Path to watermark image (PNG with transparency recommended).
        position: One of "top_left", "top_right", "bottom_left", "bottom_right", "center".
        opacity: Watermark opacity (0.0 - 1.0).
        scale: Watermark size relative to video width (0.0 - 1.0).
        output_path: Optional output path. Auto-generated if None.

    Returns:
        Path to output video with watermark.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    position_map = {
        "top_left": "10:10",
        "top_right": "main_w-overlay_w-10:10",
        "bottom_left": "10:main_h-overlay_h-10",
        "bottom_right": "main_w-overlay_w-10:main_h-overlay_h-10",
        "center": "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
    }
    pos = position_map.get(position, position_map["bottom_right"])

    filter_complex = (
        f"[1:v]scale=iw*{scale}:-1,format=rgba,"
        f"colorchannelmixer=aa={opacity}[wm];"
        f"[0:v][wm]overlay={pos}[out]"
    )

    cmd = [
        "ffmpeg", "-i", video_path, "-i", watermark_path,
        "-filter_complex", filter_complex,
        "-map", "[out]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        "-y", output_path,
    ]

    logger.info("Adding watermark to %s (pos=%s, opacity=%.1f)", video_path, position, opacity)
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def add_text_watermark(
    video_path: str,
    text: str,
    position: str = "bottom_right",
    font_size: int = 24,
    color: str = "white",
    opacity: float = 0.5,
    output_path: str | None = None,
) -> str:
    """Add text watermark to video using FFmpeg drawtext filter.

    Args:
        video_path: Path to source video.
        text: Watermark text.
        position: Positioning preset.
        font_size: Font size in pixels.
        color: Font color name or hex.
        opacity: Text opacity (0.0 - 1.0).
        output_path: Optional output path.

    Returns:
        Path to output video with text watermark.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    position_map = {
        "top_left": "x=10:y=10",
        "top_right": "x=w-tw-10:y=10",
        "bottom_left": "x=10:y=h-th-10",
        "bottom_right": "x=w-tw-10:y=h-th-10",
        "center": "x=(w-tw)/2:y=(h-th)/2",
    }
    pos = position_map.get(position, position_map["bottom_right"])

    safe_text = text.replace("'", "\\'").replace(":", "\\:")
    alpha = f"{opacity:.2f}"

    drawtext = (
        f"drawtext=text='{safe_text}':{pos}:"
        f"fontsize={font_size}:fontcolor={color}@{alpha}"
    )

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", drawtext,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        "-y", output_path,
    ]

    logger.info("Adding text watermark '%s' to %s", text, video_path)
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
