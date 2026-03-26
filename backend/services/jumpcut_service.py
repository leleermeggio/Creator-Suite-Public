from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def detect_silence(
    audio_path: str,
    silence_threshold: float = -30.0,
    min_silence_duration: float = 0.5,
) -> list[dict]:
    """Detect silence segments in audio using FFmpeg silencedetect.

    Returns list of {start, end, duration} for each silence segment.
    """
    cmd = [
        "ffmpeg",
        "-i",
        audio_path,
        "-af",
        f"silencedetect=noise={silence_threshold}dB:d={min_silence_duration}",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    silences = []
    current_start = None
    for line in stderr.split("\n"):
        if "silence_start:" in line:
            try:
                current_start = float(
                    line.split("silence_start:")[1].strip().split()[0]
                )
            except (ValueError, IndexError):
                continue
        elif "silence_end:" in line and current_start is not None:
            try:
                parts = line.split("silence_end:")[1].strip().split()
                end = float(parts[0])
                silences.append(
                    {
                        "start": round(current_start, 3),
                        "end": round(end, 3),
                        "duration": round(end - current_start, 3),
                    }
                )
                current_start = None
            except (ValueError, IndexError):
                continue

    return silences


def compute_keep_segments(
    silences: list[dict],
    total_duration: float,
    padding: float = 0.05,
) -> list[dict]:
    """Compute segments to keep (inverse of silence segments with optional padding)."""
    if not silences:
        return [{"start": 0.0, "end": total_duration}]

    keeps = []
    prev_end = 0.0
    for s in silences:
        start = max(0.0, s["start"] + padding)
        if start > prev_end:
            keeps.append({"start": round(prev_end, 3), "end": round(start, 3)})
        prev_end = max(prev_end, s["end"] - padding)

    if prev_end < total_duration:
        keeps.append({"start": round(prev_end, 3), "end": round(total_duration, 3)})

    return keeps


def get_duration(file_path: str) -> float:
    """Get media duration in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        file_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def render_jumpcut(
    input_path: str,
    keep_segments: list[dict],
    output_path: str | None = None,
) -> str:
    """Render video with silence removed by concatenating keep segments.

    Returns path to output file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)

    if not keep_segments:
        logger.warning("No segments to keep — returning empty file")
        return output_path

    # Build filter complex for segment selection
    filter_parts = []
    concat_inputs = []
    for i, seg in enumerate(keep_segments):
        filter_parts.append(
            f"[0:v]trim=start={seg['start']}:end={seg['end']},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start={seg['start']}:end={seg['end']},asetpts=PTS-STARTPTS[a{i}];"
        )
        concat_inputs.append(f"[v{i}][a{i}]")

    filter_complex = "".join(filter_parts)
    filter_complex += (
        "".join(concat_inputs) + f"concat=n={len(keep_segments)}:v=1:a=1[outv][outa]"
    )

    cmd = [
        "ffmpeg",
        "-i",
        input_path,
        "-filter_complex",
        filter_complex,
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-y",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
