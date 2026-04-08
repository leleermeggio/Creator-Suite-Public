"""Creator Suite Bot — Utility functions."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

from telegram import Update
from telegram.ext import ContextTypes

from bot.config import LOG_DIR, DOWNLOADS_DIR, MAX_CHUNK_LENGTH, _IMAGE_EXT, _VIDEO_EXT

logger = logging.getLogger("bot")

# ---------------------------------------------------------------------------
# URL Pattern
# ---------------------------------------------------------------------------
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Authorization & Chat Helpers
# ---------------------------------------------------------------------------
def _is_group(update: Update) -> bool:
    """True se la chat è un gruppo o supergruppo."""
    return update.effective_chat.type in ("group", "supergroup")


def _check_auth(update: Update, allowed_users: set[int]) -> bool:
    """Check if user is authorized."""
    user = update.effective_user
    if allowed_users and user.id not in allowed_users:
        logger.warning("⛔ Accesso negato — %s (%s)", user.full_name, user.id)
        return False
    return True


# ---------------------------------------------------------------------------
# Message Helpers
# ---------------------------------------------------------------------------
async def _del(bot, chat_id: int, msg_id: int) -> None:
    """Delete a single message, ignore errors."""
    try:
        await bot.delete_message(chat_id=chat_id, message_id=msg_id)
    except Exception:
        pass


async def _del_many(bot, chat_id: int, *msg_ids: int) -> None:
    """Cancella più messaggi in parallelo."""
    tasks = [_del(bot, chat_id, mid) for mid in msg_ids if mid]
    if tasks:
        await asyncio.gather(*tasks)


# ---------------------------------------------------------------------------
# File Helpers
# ---------------------------------------------------------------------------
def _get_ext(filename: str | None, default: str = "ogg") -> str:
    """Extract file extension from filename."""
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


def _cleanup_downloads() -> None:
    """Clean up all files in downloads directory."""
    dl_path = Path(DOWNLOADS_DIR)
    if dl_path.exists():
        for f in dl_path.iterdir():
            try:
                if f.is_file():
                    f.unlink()
                elif f.is_dir():
                    shutil.rmtree(f)
            except OSError:
                pass


def _cleanup_downloads_bg() -> None:
    """Lancia cleanup in un thread background per non bloccare la risposta."""
    try:
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, _cleanup_downloads)
    except RuntimeError:
        # No running loop, run sync
        _cleanup_downloads()


# ---------------------------------------------------------------------------
# Text Helpers
# ---------------------------------------------------------------------------
def _escape_html(text: str) -> str:
    """Escape HTML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _blockquote(html_text: str, max_lines: int = 10) -> str:
    """Wrap text in blockquote, expandable if long."""
    line_count = html_text.count("\n") + 1
    tag = "blockquote expandable" if line_count > max_lines else "blockquote"
    return f"<{tag}>{html_text}</{tag.split()[0]}>"


def _split_text(text: str, max_len: int = MAX_CHUNK_LENGTH) -> list[str]:
    """Split text into chunks respecting max length."""
    if len(text) <= max_len:
        return [text]
    chunks: list[str] = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        split_at = text.rfind("\n", 0, max_len)
        if split_at == -1:
            split_at = text.rfind(" ", 0, max_len)
        if split_at == -1:
            split_at = max_len
        chunks.append(text[:split_at])
        text = text[split_at:].lstrip()
    return chunks


# ---------------------------------------------------------------------------
# Duration Formatter
# ---------------------------------------------------------------------------
def _fmt_duration(seconds: float) -> str:
    """Formatta durata in mm:ss o hh:mm:ss."""
    s = int(seconds)
    if s >= 3600:
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}"
    m, sec = divmod(s, 60)
    return f"{m}:{sec:02d}"
