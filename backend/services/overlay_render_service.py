from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def render_text_overlay(
    video_path: str,
    overlays: list[dict],
    output_path: str | None = None,
) -> str:
    """Render text overlays onto video using FFmpeg drawtext filters.

    Each overlay dict should have:
        x, y (normalized 0-1), width, height (normalized 0-1),
        start_time, end_time (seconds or None for full duration),
        properties: {text, font_size?, color?, bg_color?}

    Args:
        video_path: Path to source video.
        overlays: List of overlay dicts sorted by layer_order.
        output_path: Optional output path.

    Returns:
        Path to output video with overlays.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    if not overlays:
        # No overlays — just copy
        cmd = ["ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    filters = []
    for ov in overlays:
        props = ov.get("properties") or {}
        text = props.get("text", "")
        if not text:
            continue

        safe_text = text.replace("'", "\\'").replace(":", "\\:")
        font_size = props.get("font_size", 32)
        color = props.get("color", "white")
        x_norm = ov.get("x", 0.0)
        y_norm = ov.get("y", 0.0)

        # Convert normalized coords to pixel expressions
        x_expr = f"w*{x_norm}"
        y_expr = f"h*{y_norm}"

        dt = f"drawtext=text='{safe_text}':x={x_expr}:y={y_expr}:fontsize={font_size}:fontcolor={color}"

        start = ov.get("start_time")
        end = ov.get("end_time")
        if start is not None and end is not None:
            dt += f":enable='between(t,{start},{end})'"
        elif start is not None:
            dt += f":enable='gte(t,{start})'"

        filters.append(dt)

    if not filters:
        cmd = ["ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    vf = ",".join(filters)
    cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-vf",
        vf,
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

    logger.info("Rendering %d text overlays onto video", len(filters))
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def render_image_overlay(
    video_path: str,
    image_path: str,
    x: float = 0.0,
    y: float = 0.0,
    scale: float = 0.2,
    start_time: float | None = None,
    end_time: float | None = None,
    opacity: float = 1.0,
    output_path: str | None = None,
) -> str:
    """Overlay an image onto video at specified position.

    Args:
        video_path: Path to source video.
        image_path: Path to overlay image (PNG recommended).
        x, y: Normalized position (0-1).
        scale: Image scale relative to video width.
        start_time, end_time: Visibility timing (None = always visible).
        opacity: Image opacity (0-1).
        output_path: Optional output path.

    Returns:
        Path to output video.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    x_expr = f"main_w*{x}"
    y_expr = f"main_h*{y}"

    filter_complex = (
        f"[1:v]scale=iw*{scale}:-1,format=rgba,"
        f"colorchannelmixer=aa={opacity}[ov];"
        f"[0:v][ov]overlay={x_expr}:{y_expr}"
    )

    if start_time is not None and end_time is not None:
        filter_complex += f":enable='between(t,{start_time},{end_time})'"
    elif start_time is not None:
        filter_complex += f":enable='gte(t,{start_time})'"

    filter_complex += "[out]"

    cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-i",
        image_path,
        "-filter_complex",
        filter_complex,
        "-map",
        "[out]",
        "-map",
        "0:a?",
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

    logger.info("Rendering image overlay onto video")
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
