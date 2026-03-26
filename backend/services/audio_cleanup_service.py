from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def normalize_audio(
    input_path: str,
    target_lufs: float = -14.0,
    output_path: str | None = None,
) -> str:
    """Normalize audio loudness to target LUFS using FFmpeg loudnorm.

    Args:
        input_path: Path to audio file.
        target_lufs: Target integrated loudness (default -14 LUFS for YouTube).
        output_path: Optional output path. Auto-generated if None.

    Returns:
        Path to normalized audio file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    cmd = [
        "ffmpeg",
        "-i",
        input_path,
        "-af",
        f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
        "-ar",
        "44100",
        "-y",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def reduce_noise_ffmpeg(
    input_path: str,
    noise_floor: float = -25.0,
    output_path: str | None = None,
) -> str:
    """Basic noise reduction using FFmpeg afftdn filter.

    For production, consider Demucs for voice isolation.

    Args:
        input_path: Path to audio file.
        noise_floor: Noise floor in dB.
        output_path: Optional output path.

    Returns:
        Path to denoised audio file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    cmd = [
        "ffmpeg",
        "-i",
        input_path,
        "-af",
        f"afftdn=nf={noise_floor}",
        "-y",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def separate_vocals_demucs(
    input_path: str,
    output_dir: str | None = None,
) -> dict[str, str]:
    """Separate vocals from background using Demucs.

    Returns dict with paths: {vocals, accompaniment, drums, bass, other}
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp()

    try:
        cmd = [
            "python",
            "-m",
            "demucs",
            "--two-stems",
            "vocals",
            "-o",
            output_dir,
            input_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)

        # Demucs outputs to output_dir/htdemucs/<filename>/
        stem = os.path.splitext(os.path.basename(input_path))[0]
        base = os.path.join(output_dir, "htdemucs", stem)

        return {
            "vocals": os.path.join(base, "vocals.wav"),
            "no_vocals": os.path.join(base, "no_vocals.wav"),
        }
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        logger.warning("Demucs failed (%s), falling back to FFmpeg noise reduction", e)
        cleaned = reduce_noise_ffmpeg(input_path)
        return {"vocals": cleaned, "no_vocals": ""}
