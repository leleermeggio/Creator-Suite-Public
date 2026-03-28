"""Creator Suite Bot — MP3 handler."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ContextTypes

from bot.config import CHOOSING, MP3_WAIT, MAX_UPLOAD_SIZE_MB
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _cleanup_downloads_bg
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def mp3_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per scaricare MP3."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🎵 %s → MP3", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🎵 <b>Scarica MP3</b> ━━\n\n"
        "Inviami il link del video\n"
        "(YouTube, TikTok, Instagram…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return MP3_WAIT


async def process_mp3(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Scarica audio MP3 da un link."""
    from bot.downloader import download_mp3
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return MP3_WAIT

    url = urls[0]
    logger.info("🎵 [MP3] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Estrazione audio…")

    try:
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_DOCUMENT)
        loop = asyncio.get_running_loop()
        mp3_path, title, uploader = await loop.run_in_executor(None, download_mp3, url)

        # Pulizia input
        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not mp3_path:
            logger.warning("⚠️  Download MP3 fallito")
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile estrarre l'audio.")
        else:
            size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
            logger.info("📦 [MP3] %s — %.1f MB", Path(mp3_path).name, size_mb)
            with open(mp3_path, "rb") as f:
                if size_mb <= MAX_UPLOAD_SIZE_MB:
                    await bot.send_audio(
                        chat_id=chat_id, audio=f,
                        title=title or None,
                        performer=uploader or None,
                        filename=f"{title or 'audio'}.mp3",
                    )
                else:
                    await bot.send_document(
                        chat_id=chat_id, document=f,
                        filename=f"{title or 'audio'}.mp3",
                    )
            logger.info("✅ [MP3] Inviato: %s", title)

    except Exception as e:
        logger.exception("💥 [MP3] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
