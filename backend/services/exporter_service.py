from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# Format presets: {preset_name: {width, height, aspect, codec, bitrate, fps}}
FORMAT_PRESETS = {
    "youtube_1080p": {
        "width": 1920, "height": 1080, "aspect": "16:9",
        "codec": "libx264", "bitrate": "8M", "fps": 30,
    },
    "youtube_shorts": {
        "width": 1080, "height": 1920, "aspect": "9:16",
        "codec": "libx264", "bitrate": "6M", "fps": 30,
    },
    "tiktok": {
        "width": 1080, "height": 1920, "aspect": "9:16",
        "codec": "libx264", "bitrate": "6M", "fps": 30,
    },
    "instagram_reel": {
        "width": 1080, "height": 1920, "aspect": "9:16",
        "codec": "libx264", "bitrate": "5M", "fps": 30,
    },
    "custom": {
        "width": 1920, "height": 1080, "aspect": "16:9",
        "codec": "libx264", "bitrate": "8M", "fps": 30,
    },
}


def get_preset(preset_name: str) -> dict:
    """Get format preset configuration."""
    return FORMAT_PRESETS.get(preset_name, FORMAT_PRESETS["custom"])


def render_export(
    input_path: str,
    preset_name: str = "youtube_1080p",
    output_path: str | None = None,
    custom_width: int | None = None,
    custom_height: int | None = None,
    custom_bitrate: str | None = None,
) -> str:
    """Render video to target format using FFmpeg.

    Args:
        input_path: Path to source video.
        preset_name: One of FORMAT_PRESETS keys.
        output_path: Optional output path. Auto-generated if None.
        custom_width: Override preset width.
        custom_height: Override preset height.
        custom_bitrate: Override preset bitrate.

    Returns:
        Path to rendered output file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    preset = get_preset(preset_name)
    width = custom_width or preset["width"]
    height = custom_height or preset["height"]
    bitrate = custom_bitrate or preset["bitrate"]
    codec = preset["codec"]
    fps = preset["fps"]

    # Scale and pad to target resolution maintaining aspect ratio
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,"
        f"fps={fps}"
    )

    cmd = [
        "ffmpeg", "-i", input_path,
        "-vf", vf,
        "-c:v", codec, "-b:v", bitrate, "-preset", "medium",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        "-movflags", "+faststart",
        "-y", output_path,
    ]

    logger.info("Rendering export: %s → %s (%s)", input_path, output_path, preset_name)
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def render_concat(
    input_paths: list[str],
    preset_name: str = "youtube_1080p",
    output_path: str | None = None,
) -> str:
    """Concatenate multiple video files and render to target format.

    Args:
        input_paths: List of video file paths to concatenate.
        preset_name: Target format preset.
        output_path: Optional output path.

    Returns:
        Path to rendered output file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    # Create concat file list
    fd, list_path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(fd, "w") as f:
            for p in input_paths:
                f.write(f"file '{p}'\n")

        preset = get_preset(preset_name)

        cmd = [
            "ffmpeg", "-f", "concat", "-safe", "0", "-i", list_path,
            "-vf", f"scale={preset['width']}:{preset['height']}:force_original_aspect_ratio=decrease,"
                   f"pad={preset['width']}:{preset['height']}:(ow-iw)/2:(oh-ih)/2:black",
            "-c:v", preset["codec"], "-b:v", preset["bitrate"],
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-y", output_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)
    finally:
        os.unlink(list_path)

    return output_path
