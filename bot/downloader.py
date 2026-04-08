"""Servizio di download media tramite yt-dlp, httpx e instaloader."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import re

import httpx
import instaloader
import yt_dlp

logger = logging.getLogger("bot.downloader")

DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR", "/app/downloads")
COOKIES_DIR = os.getenv("COOKIES_DIR", "/app/cookies")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB — limite Telegram bot

_RE_INSTAGRAM = re.compile(r"(?:www\.)?instagram\.com/", re.I)
_RE_INSTAGRAM_SC = re.compile(r"instagram\.com/(?:p|reel|reels)/([A-Za-z0-9_-]+)")


def _get_cookies(url: str) -> str | None:
    """Cerca un file cookie Netscape per il dominio dell'URL."""
    cookies_dir = Path(COOKIES_DIR)
    if not cookies_dir.exists():
        return None
    domains = ["youtube", "instagram", "twitter", "x.com", "tiktok", "facebook"]
    for domain in domains:
        if domain in url.lower():
            for f in cookies_dir.iterdir():
                if domain in f.stem.lower() and f.suffix == ".txt":
                    logger.info("🍪 Cookie trovato per %s: %s", domain, f.name)
                    return str(f)
    return None


def _base_opts() -> dict:
    """Opzioni base condivise per yt-dlp."""
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }


# ---------------------------------------------------------------------------
# Download MP3 (estrazione audio)
# ---------------------------------------------------------------------------
def download_mp3(url: str) -> tuple[str | None, str, str]:
    """Scarica l'audio da un URL come MP3.

    Returns:
        (file_path, title, uploader) — file_path è None se fallisce.
    """
    opts = _base_opts()
    opts.update({
        "format": "bestaudio/best",
        "outtmpl": os.path.join(DOWNLOADS_DIR, "%(id)s.%(ext)s"),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    })

    cookie_file = _get_cookies(url)
    if cookie_file:
        opts["cookiefile"] = cookie_file

    try:
        logger.info("🎵 [MP3] Download da: %s", url)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "Audio")
            uploader = info.get("uploader", "")
            video_id = info.get("id", "unknown")

            mp3_path = os.path.join(DOWNLOADS_DIR, f"{video_id}.mp3")
            if os.path.exists(mp3_path):
                size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
                logger.info("✅ [MP3] Scaricato: %s — %.1f MB", Path(mp3_path).name, size_mb)
                return mp3_path, title, uploader

            # Fallback: cerca qualsiasi file con lo stesso ID
            for f in Path(DOWNLOADS_DIR).iterdir():
                if f.stem == video_id and f.is_file():
                    return str(f), title, uploader

    except Exception as e:
        logger.error("❌ [MP3] Download fallito per %s: %s", url, e)
    return None, "", ""


# ---------------------------------------------------------------------------
# Download immagini / media visivi
# ---------------------------------------------------------------------------
def download_images(url: str) -> tuple[list[str], str]:
    """Scarica immagini/media da un URL.

    Per URL diretti a immagini usa httpx.
    Per Instagram usa instaloader (gestisce carousel con foto).
    Per altri social usa yt-dlp.
    Returns: (lista di file path, caption del post).
    """
    # Caso 1: URL diretto a immagine
    if _is_direct_image(url):
        path = _download_direct(url)
        return ([path], "") if path else ([], "")

    # Caso 2: Instagram → instaloader (gestisce carousel con foto + video)
    if _is_instagram(url):
        return _download_instagram(url)

    # Caso 3: Altri social → yt-dlp
    return _download_images_ytdlp(url)


def _is_instagram(url: str) -> bool:
    """Controlla se l'URL è di Instagram."""
    return bool(_RE_INSTAGRAM.search(url))


def _download_instagram(url: str) -> tuple[list[str], str]:
    """Scarica tutti i media da un post Instagram usando instaloader."""
    # Estrai lo shortcode dall'URL
    match = _RE_INSTAGRAM_SC.search(url)
    if not match:
        logger.warning("⚠️  [Instagram] Shortcode non trovato in: %s", url)
        return _download_images_ytdlp(url)  # fallback

    shortcode = match.group(1)
    logger.info("🖼  [Instagram] Download post %s via instaloader", shortcode)

    try:
        L = instaloader.Instaloader(
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            dirname_pattern=DOWNLOADS_DIR,
            filename_pattern="{shortcode}_{mediaid}",
            quiet=True,
        )

        post = instaloader.Post.from_shortcode(L.context, shortcode)

        # Estrai caption
        caption_text = post.caption or ""
        owner = post.owner_username or ""
        caption_parts = []
        if owner:
            caption_parts.append(f"<b>@{owner}</b>")
        if caption_text:
            trimmed = caption_text[:800] + ("..." if len(caption_text) > 800 else "")
            caption_parts.append(trimmed)
        caption = "\n".join(caption_parts)

        # Download
        L.download_post(post, target=Path(DOWNLOADS_DIR))

        # Raccogli i file scaricati (solo media, non .txt/.json)
        media_ext = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mkv", ".webm"}
        files = []
        for f in sorted(Path(DOWNLOADS_DIR).iterdir()):
            if f.is_file() and f.suffix.lower() in media_ext:
                size_mb = os.path.getsize(f) / (1024 * 1024)
                logger.info("   📦 %s — %.1f MB", f.name, size_mb)
                files.append(str(f))

        logger.info("✅ [Instagram] %d file scaricati", len(files))
        if caption:
            logger.info("📝 Caption: %s", caption[:100] + ("..." if len(caption) > 100 else ""))
        return files, caption

    except Exception as e:
        logger.error("❌ [Instagram] instaloader fallito: %s — provo yt-dlp...", e)
        return _download_images_ytdlp(url)


def _download_images_ytdlp(url: str) -> tuple[list[str], str]:
    """Scarica media da un URL generico usando yt-dlp."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": False,
        "outtmpl": os.path.join(DOWNLOADS_DIR, "%(id)s.%(ext)s"),
        "format": "best",
    }

    cookie_file = _get_cookies(url)
    if cookie_file:
        opts["cookiefile"] = cookie_file

    caption = ""
    try:
        logger.info("🖼  [Immagini] Download da: %s", url)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        caption = _extract_caption(info)

        entries = info.get("entries", [info]) if info.get("_type") == "playlist" else [info]
        if isinstance(entries, list):
            logger.info("📦 [Immagini] %d entries trovate nel post", len(entries))
        else:
            entries = list(entries)
            logger.info("📦 [Immagini] %d entries trovate nel post", len(entries))

        files = []
        for f in sorted(Path(DOWNLOADS_DIR).iterdir()):
            if f.is_file():
                size_mb = os.path.getsize(f) / (1024 * 1024)
                logger.info("   📦 %s — %.1f MB", f.name, size_mb)
                files.append(str(f))

        logger.info("✅ [Immagini] %d file scaricati", len(files))
        if caption:
            logger.info("📝 Caption: %s", caption[:100] + ("..." if len(caption) > 100 else ""))
        return files, caption

    except Exception as e:
        logger.error("❌ [Immagini] Download fallito per %s: %s", url, e)
    return [], ""


def _extract_caption(info: dict) -> str:
    """Estrai la caption/descrizione dal risultato yt-dlp."""
    desc = info.get("description", "")
    if not desc and info.get("_type") == "playlist":
        entries = info.get("entries", [])
        if entries:
            first = entries[0] if isinstance(entries, list) else next(iter(entries), {})
            desc = first.get("description", "") if isinstance(first, dict) else ""

    title = info.get("title", "")
    uploader = info.get("uploader", "") or info.get("channel", "")

    parts = []
    if uploader:
        parts.append(f"<b>{uploader}</b>")
    if desc:
        trimmed = desc[:800] + ("..." if len(desc) > 800 else "")
        parts.append(trimmed)
    elif title and title != uploader:
        parts.append(title)

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Download audio per trascrizione
# ---------------------------------------------------------------------------
def download_audio(url: str) -> str | None:
    """Scarica l'audio da un URL per la trascrizione Whisper.

    Returns: path del file audio o None.
    """
    opts = _base_opts()
    opts.update({
        "format": "bestaudio/best",
        "outtmpl": os.path.join(DOWNLOADS_DIR, "%(id)s.%(ext)s"),
    })

    cookie_file = _get_cookies(url)
    if cookie_file:
        opts["cookiefile"] = cookie_file

    try:
        logger.info("🎧 [Audio] Download da: %s", url)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "unknown")

            for f in Path(DOWNLOADS_DIR).iterdir():
                if f.stem == video_id and f.is_file():
                    size_mb = os.path.getsize(f) / (1024 * 1024)
                    logger.info("✅ [Audio] Scaricato: %s — %.1f MB", f.name, size_mb)
                    return str(f)

    except Exception as e:
        logger.error("❌ [Audio] Download fallito per %s: %s", url, e)
    return None


# ---------------------------------------------------------------------------
# Helper: download diretto immagini
# ---------------------------------------------------------------------------
_IMAGE_EXTENSIONS = frozenset((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"))


def _is_direct_image(url: str) -> bool:
    """Controlla se l'URL punta direttamente a un'immagine."""
    path = url.split("?")[0].lower()
    return Path(path).suffix in _IMAGE_EXTENSIONS


def download_video(url: str) -> tuple[str | None, str | None]:
    """Scarica un video come MP4. Returns (path, title)."""
    opts = _base_opts()
    opts.update({
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": os.path.join(DOWNLOADS_DIR, "%(id)s.%(ext)s"),
        "merge_output_format": "mp4",
    })

    cookie_file = _get_cookies(url)
    if cookie_file:
        opts["cookiefile"] = cookie_file

    try:
        logger.info("📹 [Video] Download da: %s", url)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "video")
            video_id = info.get("id", "unknown")

            # Cerca il file scaricato
            mp4_path = os.path.join(DOWNLOADS_DIR, f"{video_id}.mp4")
            if os.path.exists(mp4_path):
                size_mb = os.path.getsize(mp4_path) / (1024 * 1024)
                logger.info("✅ [Video] %s — %.1f MB", Path(mp4_path).name, size_mb)
                return mp4_path, title

            for f in Path(DOWNLOADS_DIR).iterdir():
                if f.stem == video_id and f.is_file():
                    size_mb = os.path.getsize(f) / (1024 * 1024)
                    logger.info("✅ [Video] %s — %.1f MB", f.name, size_mb)
                    return str(f), title

    except Exception as e:
        logger.error("❌ [Video] Download fallito: %s", e)
    return None, None


def get_link_info(url: str) -> dict | None:
    """Estrae metadati da un URL senza scaricare nulla."""
    opts = _base_opts()
    opts["skip_download"] = True

    cookie_file = _get_cookies(url)
    if cookie_file:
        opts["cookiefile"] = cookie_file

    try:
        logger.info("📊 [Info] Estrazione da: %s", url)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            result = {
                "title": info.get("title"),
                "uploader": info.get("uploader") or info.get("channel"),
                "duration": info.get("duration"),
                "view_count": info.get("view_count"),
                "like_count": info.get("like_count"),
                "description": (info.get("description") or "")[:500],
                "thumbnail": info.get("thumbnail"),
                "upload_date": info.get("upload_date"),
                "url": url,
                "ext": info.get("ext"),
                "filesize_approx": info.get("filesize_approx"),
            }
            logger.info("✅ [Info] %s", result.get("title", "?"))
            return result
    except Exception as e:
        logger.error("❌ [Info] Estrazione fallita: %s", e)
    return None


def _download_direct(url: str) -> str | None:
    """Scarica un'immagine da URL diretto con httpx (streaming)."""
    try:
        logger.info("🖼  [Diretto] Download: %s", url)
        with httpx.stream("GET", url, follow_redirects=True, timeout=30) as response:
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            ext = ".jpg"
            if "png" in content_type:
                ext = ".png"
            elif "gif" in content_type:
                ext = ".gif"
            elif "webp" in content_type:
                ext = ".webp"

            filename = f"direct_image{ext}"
            filepath = os.path.join(DOWNLOADS_DIR, filename)
            with open(filepath, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=65536):
                    f.write(chunk)

        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        logger.info("✅ [Diretto] Salvato: %s — %.1f MB", filename, size_mb)
        return filepath

    except Exception as e:
        logger.error("❌ [Diretto] Download fallito: %s", e)
    return None
