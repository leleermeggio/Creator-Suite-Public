"""Creator Suite Bot — Info Link handler."""

from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, INFO_WAIT
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _cleanup_downloads_bg
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def info_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per info link."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📊 %s → Info Link", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 📊 <b>Info Link</b> ━━\n\n"
        "Inviami un link e ti mostrerò\n"
        "titolo, autore, durata, visualizzazioni…",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return INFO_WAIT


async def process_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra informazioni su un link."""
    from bot.downloader import get_link_info
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return INFO_WAIT

    url = urls[0]
    logger.info("📊 [Info] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Analisi link…")

    try:
        loop = asyncio.get_running_loop()
        info = await loop.run_in_executor(None, get_link_info, url)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not info:
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile analizzare il link.")
        else:
            lines = ["📊 <b>Info Link</b>\n"]
            if info.get("title"):
                lines.append(f"📌 <b>Titolo:</b> {_escape_html(info['title'])}")
            if info.get("uploader"):
                lines.append(f"👤 <b>Autore:</b> {_escape_html(info['uploader'])}")
            if info.get("duration"):
                dur = info["duration"]
                m, s = divmod(int(dur), 60)
                h, m = divmod(m, 60)
                dur_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
                lines.append(f"⏱ <b>Durata:</b> {dur_str}")
            if info.get("view_count"):
                lines.append(f"👁 <b>Visualizzazioni:</b> {info['view_count']:,}".replace(",", "."))
            if info.get("like_count"):
                lines.append(f"❤️ <b>Like:</b> {info['like_count']:,}".replace(",", "."))
            if info.get("upload_date"):
                d = info["upload_date"]
                if len(d) == 8:
                    lines.append(f"📅 <b>Data:</b> {d[6:8]}/{d[4:6]}/{d[:4]}")
            if info.get("description"):
                desc = _escape_html(info["description"][:300])
                lines.append(f"\n📝 <b>Descrizione:</b>\n<blockquote>{desc}</blockquote>")

            text = "\n".join(lines)
            await bot.send_message(chat_id=chat_id, text=text, parse_mode=ParseMode.HTML)
            logger.info("✅ [Info] Inviato per: %s", info.get("title", "?"))

    except Exception as e:
        logger.exception("💥 [Info] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")

    await _send_menu(bot, chat_id, context)
    return CHOOSING
