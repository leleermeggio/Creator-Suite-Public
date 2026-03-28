"""Creator Suite Bot — Video handler."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, VIDEO_WAIT, MAX_UPLOAD_SIZE_MB
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _cleanup_downloads_bg
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def video_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per scaricare video."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📹 %s → Video", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 📹 <b>Scarica Video</b> ━━\n\n"
        "Inviami il link del video\n"
        "(YouTube, TikTok, Instagram…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return VIDEO_WAIT


async def process_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Scarica video da un link."""
    from bot.downloader import download_video
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return VIDEO_WAIT

    url = urls[0]
    logger.info("📹 [Video] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Download video in corso…")

    try:
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_VIDEO)
        loop = asyncio.get_running_loop()
        video_path, title = await loop.run_in_executor(None, download_video, url)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not video_path:
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile scaricare il video.")
        else:
            size_mb = os.path.getsize(video_path) / (1024 * 1024)
            logger.info("📦 [Video] %s — %.1f MB", Path(video_path).name, size_mb)
            with open(video_path, "rb") as f:
                if size_mb <= MAX_UPLOAD_SIZE_MB:
                    await bot.send_video(
                        chat_id=chat_id, video=f,
                        caption=f"🎬 <b>{_escape_html(title or 'Video')}</b>",
                        parse_mode=ParseMode.HTML,
                        supports_streaming=True,
                    )
                else:
                    await bot.send_document(
                        chat_id=chat_id, document=f,
                        caption=f"🎬 <b>{_escape_html(title or 'Video')}</b>",
                        parse_mode=ParseMode.HTML,
                    )
            logger.info("✅ [Video] Inviato: %s", title)

    except Exception as e:
        logger.exception("💥 [Video] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
