"""Unified jump-cut service — frame-accurate silence removal for any media format.

Supports: .mp4, .mov, .mkv, .webm, .mp3, .wav, .aac, .flac, .ogg, .m4a, and more.
Uses ffprobe for probing and ffmpeg filter_complex (trim/atrim) for frame-accurate cuts.
Applies short audio crossfades between segments to prevent pops/clicks.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults (overridable via env)
# ---------------------------------------------------------------------------
SILENCE_THRESH_DB: float = float(os.getenv("JUMPCUT_SILENCE_THRESH", "-35"))
MIN_SILENCE_SEC: float = float(os.getenv("JUMPCUT_MIN_SILENCE", "0.4"))
PADDING_SEC: float = float(os.getenv("JUMPCUT_PADDING", "0.12"))
CROSSFADE_SEC: float = float(os.getenv("JUMPCUT_CROSSFADE", "0.03"))
MIN_SEGMENT_SEC: float = 0.08  # discard segments shorter than 80 ms

_RE_SILENCE_START = re.compile(r"silence_start:\s*([\d.]+)")
_RE_SILENCE_END = re.compile(r"silence_end:\s*([\d.]+)")

# Audio-only extensions (no video stream expected)
_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".aac",
    ".flac",
    ".ogg",
    ".m4a",
    ".wma",
    ".opus",
}

# Codec mapping per output container
_CODEC_MAP: dict[str, dict[str, list[str]]] = {
    ".mp4": {
        "video": ["-c:v", "libx264", "-preset", "medium", "-crf", "18"],
        "audio": ["-c:a", "aac", "-b:a", "192k"],
    },
    ".mov": {
        "video": ["-c:v", "libx264", "-preset", "medium", "-crf", "18"],
        "audio": ["-c:a", "aac", "-b:a", "192k"],
    },
    ".mkv": {
        "video": ["-c:v", "libx264", "-preset", "medium", "-crf", "18"],
        "audio": ["-c:a", "aac", "-b:a", "192k"],
    },
    ".webm": {
        "video": ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"],
        "audio": ["-c:a", "libopus", "-b:a", "192k"],
    },
    ".mp3": {
        "audio": ["-c:a", "libmp3lame", "-b:a", "192k"],
    },
    ".wav": {
        "audio": ["-c:a", "pcm_s16le"],
    },
    ".flac": {
        "audio": ["-c:a", "flac"],
    },
    ".aac": {
        "audio": ["-c:a", "aac", "-b:a", "192k"],
    },
    ".m4a": {
        "audio": ["-c:a", "aac", "-b:a", "192k"],
    },
    ".ogg": {
        "audio": ["-c:a", "libvorbis", "-b:a", "192k"],
    },
    ".opus": {
        "audio": ["-c:a", "libopus", "-b:a", "192k"],
    },
}

# Fallback codecs
_DEFAULT_VIDEO_CODEC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18"]
_DEFAULT_AUDIO_CODEC = ["-c:a", "aac", "-b:a", "192k"]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class MediaInfo:
    """Probed media information."""

    duration: float = 0.0
    has_video: bool = False
    has_audio: bool = False
    video_codec: str = ""
    audio_codec: str = ""
    width: int = 0
    height: int = 0
    sample_rate: int = 0
    extension: str = ""


@dataclass
class JumpCutResult:
    """Result of a jump-cut process."""

    output_path: str | None = None
    original_duration: float = 0.0
    final_duration: float = 0.0
    segments_count: int = 0
    error: str | None = None
    removed_pct: float = field(init=False, default=0.0)

    def __post_init__(self) -> None:
        if self.original_duration > 0:
            self.removed_pct = (
                (self.original_duration - self.final_duration)
                / self.original_duration
                * 100
            )


# ---------------------------------------------------------------------------
# ffprobe / ffmpeg helpers
# ---------------------------------------------------------------------------
def check_ffmpeg() -> bool:
    """Return True if ffmpeg and ffprobe are reachable."""
    for tool in ("ffmpeg", "ffprobe"):
        try:
            subprocess.run([tool, "-version"], capture_output=True, timeout=10)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    return True


def probe_media(file_path: str) -> MediaInfo:
    """Probe a media file with ffprobe and return structured info."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,sample_rate",
        "-of",
        "json",
        file_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        logger.error("ffprobe failed: %s", result.stderr[:300])
        return MediaInfo()

    data = json.loads(result.stdout)
    info = MediaInfo(extension=Path(file_path).suffix.lower())

    fmt = data.get("format", {})
    info.duration = float(fmt.get("duration", 0))

    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type", "")
        if codec_type == "video":
            info.has_video = True
            info.video_codec = stream.get("codec_name", "")
            info.width = int(stream.get("width", 0))
            info.height = int(stream.get("height", 0))
        elif codec_type == "audio":
            info.has_audio = True
            info.audio_codec = stream.get("codec_name", "")
            info.sample_rate = int(stream.get("sample_rate", 0))

    return info


def get_duration(file_path: str) -> float:
    """Get media duration in seconds (convenience wrapper)."""
    return probe_media(file_path).duration


# ---------------------------------------------------------------------------
# Silence detection
# ---------------------------------------------------------------------------
def detect_silence(
    file_path: str,
    silence_threshold: float = SILENCE_THRESH_DB,
    min_silence_duration: float = MIN_SILENCE_SEC,
) -> list[dict]:
    """Detect silence segments using ffmpeg silencedetect.

    Returns list of ``{"start": float, "end": float, "duration": float}``.
    """
    cmd = [
        "ffmpeg",
        "-i",
        file_path,
        "-af",
        f"silencedetect=noise={silence_threshold}dB:d={min_silence_duration}",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    stderr = result.stderr

    starts = [float(m.group(1)) for m in _RE_SILENCE_START.finditer(stderr)]
    ends = [float(m.group(1)) for m in _RE_SILENCE_END.finditer(stderr)]

    silences: list[dict] = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else get_duration(file_path)
        silences.append(
            {
                "start": round(s, 3),
                "end": round(e, 3),
                "duration": round(e - s, 3),
            }
        )

    logger.info("Detected %d silence segments", len(silences))
    return silences


# ---------------------------------------------------------------------------
# Segment computation
# ---------------------------------------------------------------------------
def compute_keep_segments(
    silences: list[dict],
    total_duration: float,
    padding: float = PADDING_SEC,
) -> list[dict]:
    """Compute segments to keep (inverse of silences with padding).

    Returns list of ``{"start": float, "end": float}``.
    """
    if not silences:
        return [{"start": 0.0, "end": total_duration}]

    keeps: list[dict] = []
    prev_end = 0.0

    for s in silences:
        seg_end = max(0.0, s["start"] + padding)
        if seg_end > prev_end + MIN_SEGMENT_SEC:
            keeps.append({"start": round(prev_end, 3), "end": round(seg_end, 3)})
        prev_end = max(prev_end, s["end"] - padding)

    if prev_end < total_duration - MIN_SEGMENT_SEC:
        keeps.append({"start": round(prev_end, 3), "end": round(total_duration, 3)})

    # Merge segments that overlap due to padding
    merged: list[dict] = []
    for seg in keeps:
        if merged and seg["start"] <= merged[-1]["end"]:
            merged[-1]["end"] = max(merged[-1]["end"], seg["end"])
        else:
            merged.append(dict(seg))

    logger.info("Keeping %d segments out of %.1fs total", len(merged), total_duration)
    return merged


# ---------------------------------------------------------------------------
# Render — frame-accurate filter_complex approach
# ---------------------------------------------------------------------------
def _build_filter_complex(
    segments: list[dict],
    *,
    has_video: bool,
    has_audio: bool,
    crossfade: float = CROSSFADE_SEC,
) -> tuple[str, list[str]]:
    """Build an ffmpeg filter_complex string for trim/atrim + concat.

    Returns (filter_complex_string, ["-map", ...] args).
    """
    parts: list[str] = []
    n = len(segments)

    if has_video and has_audio:
        # Trim each segment — per-segment afade prevents clicks at cut points
        for i, seg in enumerate(segments):
            duration = seg["end"] - seg["start"]
            parts.append(
                f"[0:v]trim=start={seg['start']:.4f}:end={seg['end']:.4f},"
                f"setpts=PTS-STARTPTS[v{i}];"
            )
            # Apply fade in at start and fade out at end of each segment
            parts.append(
                f"[0:a]atrim=start={seg['start']:.4f}:end={seg['end']:.4f},"
                f"asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={min(crossfade, duration / 2):.3f},"
                f"afade=t=out:st={max(0, duration - crossfade):.3f}:d={min(crossfade, duration / 2):.3f}[a{i}];"
            )
        # Interleave video and audio inputs for concat filter (v0,a0,v1,a1,...)
        interleaved = "".join(f"[v{i}][a{i}]" for i in range(n))
        parts.append(f"{interleaved}concat=n={n}:v=1:a=1[outv][outa]")
        filter_str = "".join(parts)
        map_args = ["-map", "[outv]", "-map", "[outa]"]

    elif has_audio:
        # Audio-only: atrim + concat
        for i, seg in enumerate(segments):
            duration = seg["end"] - seg["start"]
            parts.append(
                f"[0:a]atrim=start={seg['start']:.4f}:end={seg['end']:.4f},"
                f"asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={min(crossfade, duration / 2):.3f},"
                f"afade=t=out:st={max(0, duration - crossfade):.3f}:d={min(crossfade, duration / 2):.3f}[a{i}];"
            )
        a_inputs = "".join(f"[a{i}]" for i in range(n))
        parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
        filter_str = "".join(parts)
        map_args = ["-map", "[outa]"]

    else:
        # Video-only (rare): trim + concat, no audio
        for i, seg in enumerate(segments):
            parts.append(
                f"[0:v]trim=start={seg['start']:.4f}:end={seg['end']:.4f},"
                f"setpts=PTS-STARTPTS[v{i}];"
            )
        v_inputs = "".join(f"[v{i}]" for i in range(n))
        parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
        filter_str = "".join(parts)
        map_args = ["-map", "[outv]"]

    return filter_str, map_args


def _get_codec_args(ext: str, *, has_video: bool, has_audio: bool) -> list[str]:
    """Return ffmpeg codec arguments for the given output extension."""
    mapping = _CODEC_MAP.get(ext, {})
    args: list[str] = []
    if has_video:
        args.extend(mapping.get("video", _DEFAULT_VIDEO_CODEC))
    if has_audio:
        args.extend(mapping.get("audio", _DEFAULT_AUDIO_CODEC))
    return args


def render_jumpcut(
    input_path: str,
    keep_segments: list[dict],
    output_path: str | None = None,
    crossfade: float = CROSSFADE_SEC,
) -> str:
    """Render media with silence removed using frame-accurate trim filters.

    Supports any format ffmpeg can read. Output format is inferred from
    *input_path* extension (preserved), or from *output_path* if given.

    Returns path to output file.
    """
    info = probe_media(input_path)
    in_ext = info.extension or ".mp4"

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=in_ext)
        os.close(fd)

    out_ext = Path(output_path).suffix.lower() or in_ext

    if not keep_segments:
        logger.warning("No segments to keep — returning empty file")
        return output_path

    filter_str, map_args = _build_filter_complex(
        keep_segments,
        has_video=info.has_video,
        has_audio=info.has_audio,
        crossfade=crossfade,
    )

    codec_args = _get_codec_args(
        out_ext,
        has_video=info.has_video,
        has_audio=info.has_audio,
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-filter_complex",
        filter_str,
        *map_args,
        *codec_args,
        "-movflags",
        "+faststart",
        "-avoid_negative_ts",
        "make_zero",
        output_path,
    ]

    logger.debug("ffmpeg cmd: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    if result.returncode != 0:
        logger.error("ffmpeg render failed: %s", result.stderr[-500:])
        raise RuntimeError(f"ffmpeg render failed: {result.stderr[-300:]}")

    return output_path


# ---------------------------------------------------------------------------
# High-level API (used by bot and backend workers)
# ---------------------------------------------------------------------------
def process_jumpcut(
    input_path: str,
    output_dir: str,
    noise_db: float = SILENCE_THRESH_DB,
    min_silence: float = MIN_SILENCE_SEC,
    padding: float = PADDING_SEC,
    crossfade: float = CROSSFADE_SEC,
) -> JumpCutResult:
    """Process a media file removing silences — single entry point.

    Args:
        input_path: path to source media file.
        output_dir: directory for the output file.
        noise_db: silence threshold in dB (e.g. -35).
        min_silence: minimum silence duration to cut (seconds).
        padding: padding to keep around speech (seconds).
        crossfade: audio crossfade duration at segment edges (seconds).

    Returns:
        JumpCutResult with stats and output path.
    """
    tmp_dir = None
    try:
        # 0. Probe
        info = probe_media(input_path)
        if info.duration <= 0:
            return JumpCutResult(
                error="Cannot determine media duration. File may be corrupted.",
            )
        if not info.has_audio:
            return JumpCutResult(
                error="No audio track found. Jump-cut requires audio to detect silence.",
            )

        logger.info(
            "Jump-cut start — duration=%.1fs video=%s audio=%s ext=%s",
            info.duration,
            info.has_video,
            info.has_audio,
            info.extension,
        )

        # 1. Detect silences
        silences = detect_silence(input_path, noise_db, min_silence)
        if not silences:
            return JumpCutResult(
                error="No silence detected. Try raising the threshold (e.g. -30 dB).",
            )

        # 2. Compute keep segments
        segments = compute_keep_segments(silences, info.duration, padding)
        if not segments:
            return JumpCutResult(
                error="No segments to keep — the file seems to be all silence.",
            )

        # 3. Render
        stem = Path(input_path).stem
        ext = info.extension or ".mp4"
        # Use original extension for output
        output_path = os.path.join(output_dir, f"{stem}_jumpcut{ext}")

        tmp_dir = tempfile.mkdtemp(prefix="jumpcut_")
        # Use a temp file first, then move to final location
        tmp_output = os.path.join(tmp_dir, f"output{ext}")

        logger.info("Rendering %d segments...", len(segments))
        render_jumpcut(input_path, segments, tmp_output, crossfade)

        # Move to final destination
        shutil.move(tmp_output, output_path)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return JumpCutResult(
                error="Render produced an empty file.",
            )

        # 4. Stats
        final_duration = get_duration(output_path)
        size_mb = os.path.getsize(output_path) / (1024 * 1024)

        logger.info(
            "Jump-cut done — %.1fs → %.1fs (%.1f%% removed, %.1f MB)",
            info.duration,
            final_duration,
            (info.duration - final_duration) / info.duration * 100,
            size_mb,
        )

        return JumpCutResult(
            output_path=output_path,
            original_duration=info.duration,
            final_duration=final_duration,
            segments_count=len(segments),
        )

    except subprocess.TimeoutExpired:
        logger.error("Jump-cut timed out")
        return JumpCutResult(error="Timeout: file is too long or complex.")
    except Exception as e:
        logger.exception("Jump-cut unexpected error: %s", e)
        return JumpCutResult(error=f"Unexpected error: {e}")
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
