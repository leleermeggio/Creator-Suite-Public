"""Creator Suite Bot — Configuration and constants."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ---------------------------------------------------------------------------
# Telegram Limits
# ---------------------------------------------------------------------------
MAX_UPLOAD_SIZE_MB = 50
MAX_DOWNLOAD_SIZE_MB = 20
MAX_CAPTION_LENGTH = 1024
MAX_MESSAGE_LENGTH = 4096
MAX_CHUNK_LENGTH = 3900  # Conservative for message splitting

# ---------------------------------------------------------------------------
# Environment Configuration
# ---------------------------------------------------------------------------
TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
ALLOWED_USERS = {
    int(uid.strip())
    for uid in os.getenv("ALLOWED_USERS", "").split(",")
    if uid.strip()
}

# Paths
DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR", "/app/downloads")
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")
LOG_DIR = os.getenv("LOG_DIR", "/app/logs")

# Whisper
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
TRANSCRIBE_LANGUAGE = os.getenv("TRANSCRIBE_LANGUAGE", "it")

# Jump Cut
JUMPCUT_SILENCE_THRESH = os.getenv("JUMPCUT_SILENCE_THRESH", "-35")
JUMPCUT_MIN_SILENCE = os.getenv("JUMPCUT_MIN_SILENCE", "0.4")
JUMPCUT_PADDING = os.getenv("JUMPCUT_PADDING", "0.1")

# ---------------------------------------------------------------------------
# File Extensions
# ---------------------------------------------------------------------------
_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
_VIDEO_EXT = {".mp4", ".mkv", ".webm", ".avi", ".mov"}

# ---------------------------------------------------------------------------
# Conversation States
# ---------------------------------------------------------------------------
(
    CHOOSING,
    TRANSCRIBE_WAIT,
    TRANSLATE_LANG,
    TRANSLATE_WAIT,
    IMAGES_WAIT,
    MP3_WAIT,
    VIDEO_WAIT,
    SUMMARIZE_WAIT,
    OCR_WAIT,
    INFO_WAIT,
    TTS_WAIT,
    CONVERT_FMT,
    CONVERT_WAIT,
    JUMPCUT_WAIT,
) = range(14)

# ---------------------------------------------------------------------------
# Ensure directories exist
# ---------------------------------------------------------------------------
def ensure_directories() -> None:
    """Create necessary directories if they don't exist."""
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
    Path(DOWNLOADS_DIR).mkdir(parents=True, exist_ok=True)
    Path(AUDIO_DIR).mkdir(parents=True, exist_ok=True)
