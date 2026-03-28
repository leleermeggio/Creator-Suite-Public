"""Creator Suite Bot — Text-to-Speech handler."""

from __future__ import annotations

import logging
import os

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, TTS_WAIT
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _blockquote, _cleanup_downloads_bg
from bot.services import text_to_speech

logger = logging.getLogger("bot")


async def tts_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per TTS."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🗣️ %s → TTS", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🗣️ <b>Text-to-Speech</b> ━━\n\n"
        "Inviami un testo e lo convertirò\n"
        "in un messaggio vocale.",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return TTS_WAIT


async def process_tts(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Converte testo in audio."""
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    text = (msg.text or "").strip()
    if not text:
        await msg.reply_text("⚠️ Inviami un testo da convertire in voce.", reply_markup=BACK_KB)
        return TTS_WAIT

    logger.info("🗣️ [TTS] Testo da %s — %d car.", user.full_name, len(text))
    status_msg = await msg.reply_text("⏳ Generazione vocale…")

    try:
        tts_path = await text_to_speech(text)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not tts_path or not os.path.exists(tts_path):
            await bot.send_message(chat_id=chat_id, text="❌ Generazione vocale fallita.")
        else:
            # Mostra il testo originale collapsato sopra l'audio
            escaped = _escape_html(text)
            preview = _blockquote(escaped, max_lines=3)
            await bot.send_message(
                chat_id=chat_id,
                text=f"🗣️ <b>Text-to-Speech</b>\n\n{preview}",
                parse_mode=ParseMode.HTML,
            )
            with open(tts_path, "rb") as f:
                await bot.send_voice(chat_id=chat_id, voice=f)
            logger.info("✅ [TTS] Vocale inviato")
            try:
                os.remove(tts_path)
            except OSError:
                pass

    except Exception as e:
        logger.exception("💥 [TTS] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")

    await _send_menu(bot, chat_id, context)
    return CHOOSING
