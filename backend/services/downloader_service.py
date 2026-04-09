from __future__ import annotations

import logging
import os
import tempfile
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

MAX_DOWNLOAD_SIZE_BYTES = 500 * 1024 * 1024  # 500MB
DOWNLOAD_TIMEOUT_SECONDS = 60


def _validate_url(url: str) -> None:
    """Validate URL scheme and format.

    Args:
        url: URL to validate.

    Raises:
        ValueError: If URL is invalid or uses non-http(s) scheme.
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise ValueError(f"Invalid URL format: {e}")

    if not parsed.scheme or parsed.scheme not in ("http", "https"):
        raise ValueError(
            f"Invalid URL scheme '{parsed.scheme}'. Only http:// and https:// allowed."
        )

    # Basic hostname validation for non-yt-dlp URLs
    if not parsed.netloc:
        raise ValueError("URL must have a valid hostname")


def download_from_url(
    url: str,
    output_dir: str | None = None,
    max_duration: int = 10800,  # 3 hours
) -> dict:
    """Download media from URL using yt-dlp.

    Args:
        url: URL to download from (YouTube, social media, direct link).
        output_dir: Directory to save downloaded file. Auto-generated if None.
        max_duration: Maximum allowed duration in seconds.

    Returns:
        dict with keys: filepath, filename, mime_type, size_bytes, duration_seconds, title

    Raises:
        ValueError: If URL invalid or download exceeds limits.
    """
    # Validate URL
    _validate_url(url)

    try:
        import yt_dlp
    except ImportError:
        logger.error("yt-dlp not installed — run: pip install yt-dlp")
        raise

    if output_dir is None:
        output_dir = tempfile.mkdtemp()

    output_template = os.path.join(output_dir, "%(title)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "match_filter": f"duration <= {max_duration}",
        "socket_timeout": DOWNLOAD_TIMEOUT_SECONDS,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            raise ValueError(f"Failed to extract info from URL: {url}")

        filepath = ydl.prepare_filename(info)
        # yt-dlp may change extension after merge
        if not os.path.exists(filepath):
            base = os.path.splitext(filepath)[0]
            for ext in [".mp4", ".mkv", ".webm", ".mp3", ".m4a"]:
                candidate = base + ext
                if os.path.exists(candidate):
                    filepath = candidate
                    break

        filename = os.path.basename(filepath)
        size_bytes = os.path.getsize(filepath) if os.path.exists(filepath) else 0

        # Download size limit check
        if size_bytes > MAX_DOWNLOAD_SIZE_BYTES:
            raise ValueError(
                f"Downloaded file too large: {size_bytes / (1024 * 1024):.1f}MB (max 500MB)"
            )
        duration = info.get("duration", 0) or 0

        # Determine mime type from extension
        ext = os.path.splitext(filename)[1].lower()
        mime_map = {
            ".mp4": "video/mp4",
            ".mkv": "video/x-matroska",
            ".webm": "video/webm",
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")

        return {
            "filepath": filepath,
            "filename": filename,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "duration_seconds": float(duration),
            "title": info.get("title", filename),
        }
