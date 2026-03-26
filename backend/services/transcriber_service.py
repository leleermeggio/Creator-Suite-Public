from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)


def transcribe_audio(
    audio_path: str,
    model_name: str = "small",
    language: str | None = None,
) -> dict:
    """Transcribe audio using Whisper and return word-level timestamps.

    Args:
        audio_path: Path to audio/video file.
        model_name: Whisper model name (small, medium, large-v3).
        language: Optional language code (e.g. "it", "en").

    Returns:
        dict with keys: text, segments[{start, end, text, words[{word, start, end}]}]
    """
    try:
        import whisper
    except ImportError:
        logger.error("whisper not installed — run: pip install openai-whisper")
        raise

    logger.info("Loading Whisper model: %s", model_name)
    model = whisper.load_model(model_name)

    options = {"word_timestamps": True}
    if language:
        options["language"] = language

    logger.info("Transcribing: %s", audio_path)
    result = model.transcribe(audio_path, **options)

    segments = []
    for seg in result.get("segments", []):
        words = []
        for w in seg.get("words", []):
            words.append(
                {
                    "word": w["word"].strip(),
                    "start": round(w["start"], 3),
                    "end": round(w["end"], 3),
                }
            )
        segments.append(
            {
                "start": round(seg["start"], 3),
                "end": round(seg["end"], 3),
                "text": seg["text"].strip(),
                "words": words,
            }
        )

    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language", language or "unknown"),
        "segments": segments,
    }


def extract_audio(video_path: str, output_path: str | None = None) -> str:
    """Extract audio from video file using FFmpeg.

    Returns path to extracted WAV file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-y",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
