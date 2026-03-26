from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def mix_audio_tracks(
    track_paths: list[str],
    volumes: list[float] | None = None,
    output_path: str | None = None,
) -> str:
    """Mix multiple audio tracks into a single output.

    Args:
        track_paths: List of audio file paths to mix.
        volumes: Optional per-track volume multipliers (1.0 = unchanged).
        output_path: Optional output path. Auto-generated if None.

    Returns:
        Path to mixed audio file.
    """
    if not track_paths:
        raise ValueError("No tracks to mix")

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    if volumes is None:
        volumes = [1.0] * len(track_paths)

    if len(track_paths) == 1:
        # Single track — just apply volume
        cmd = [
            "ffmpeg", "-i", track_paths[0],
            "-af", f"volume={volumes[0]}",
            "-y", output_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    # Multiple tracks — build amix filter
    inputs = []
    filter_parts = []
    for i, (path, vol) in enumerate(zip(track_paths, volumes)):
        inputs.extend(["-i", path])
        filter_parts.append(f"[{i}]volume={vol}[a{i}]")

    mix_inputs = "".join(f"[a{i}]" for i in range(len(track_paths)))
    filter_complex = ";".join(filter_parts) + f";{mix_inputs}amix=inputs={len(track_paths)}:normalize=0[out]"

    cmd = ["ffmpeg"] + inputs + [
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-y", output_path,
    ]

    logger.info("Mixing %d audio tracks", len(track_paths))
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def extract_audio(
    video_path: str,
    output_path: str | None = None,
) -> str:
    """Extract audio track from video file.

    Returns path to extracted WAV file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2",
        "-y", output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
