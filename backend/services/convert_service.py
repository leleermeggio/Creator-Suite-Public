from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

CONVERT_FORMATS = {
    "mp3": ["-vn", "-codec:a", "libmp3lame", "-q:a", "2"],
    "wav": ["-vn", "-codec:a", "pcm_s16le"],
    "ogg": ["-vn", "-codec:a", "libvorbis", "-q:a", "5"],
    "flac": ["-vn", "-codec:a", "flac"],
    "aac": ["-vn", "-codec:a", "aac", "-b:a", "192k"],
    "m4a": ["-vn", "-codec:a", "aac", "-b:a", "192k"],
    "mp4": ["-codec:v", "libx264", "-preset", "fast", "-codec:a", "aac"],
    "mkv": ["-codec:v", "copy", "-codec:a", "copy"],
    "webm": ["-codec:v", "libvpx-vp9", "-codec:a", "libopus"],
}

AUDIO_FORMATS = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
VIDEO_FORMATS = {"mp4", "mkv", "webm"}


def get_supported_formats() -> list[str]:
    return sorted(CONVERT_FORMATS.keys())


def convert_media(
    input_path: str,
    target_format: str,
    output_path: str | None = None,
) -> str:
    """Convert media file to target format using FFmpeg.

    Args:
        input_path: Path to source file.
        target_format: Target format (e.g. "mp3", "mp4").
        output_path: Optional output path. Auto-generated if None.

    Returns:
        Path to converted file.

    Raises:
        ValueError: If format is not supported.
        subprocess.CalledProcessError: If FFmpeg fails.
    """
    target_format = target_format.lower().strip(".")
    if target_format not in CONVERT_FORMATS:
        raise ValueError(f"Unsupported format: {target_format}")

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=f".{target_format}")
        os.close(fd)

    args = CONVERT_FORMATS[target_format]
    cmd = ["ffmpeg", "-y", "-i", input_path] + args + [output_path]

    logger.info("Converting %s → .%s", Path(input_path).name, target_format)
    subprocess.run(cmd, check=True, capture_output=True, timeout=300)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    logger.info(
        "Converted: %s → .%s (%.1f MB)", Path(input_path).name, target_format, size_mb
    )
    return output_path
