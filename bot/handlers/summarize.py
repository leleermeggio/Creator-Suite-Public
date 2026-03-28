"""Creator Suite Bot — Summarize handler."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, SUMMARIZE_WAIT, AUDIO_DIR
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _blockquote, _split_text, _cleanup_downloads_bg, _get_ext
from bot.gemini_helper import is_gemini_available
from bot.services import summarize_text
from bot.transcriber_helper import get_transcriber, TRANSCRIBER_AVAILABLE
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def summarize_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per riassunto."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📝 %s → Riassumi", update.effective_user.full_name)

    if not is_gemini_available():
        await query.edit_message_text(
            "━━ 📝 <b>Riassumi</b> ━━\n\n"
            "⚠️ Funzione non configurata.\n"
            "Imposta <code>GOOGLE_API_KEY</code> nel file .env\n"
            "per abilitare il riassunto con Gemini AI.",
            reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
        )
        return CHOOSING

    await query.edit_message_text(
        "━━ 📝 <b>Riassumi</b> ━━\n\n"
        "Inviami:\n"
        "  ◦ Un testo da riassumere\n"
        "  ◦ Un vocale o file audio\n"
        "  ◦ Un link (trascrivo e riassumo)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return SUMMARIZE_WAIT


async def process_summarize(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora riassunto di testo, audio o link."""
    from bot.downloader import download_audio
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot
    audio_path = None
    cleanup_audio = False
    status_msg = None
    text = None

    try:
        if msg.voice or msg.audio:
            if not TRANSCRIBER_AVAILABLE:
                await msg.reply_text("⚠️ Trascrizione non disponibile. Invia solo testo.", reply_markup=BACK_KB)
                return SUMMARIZE_WAIT

            source = msg.voice or msg.audio
            logger.info("📝 [Riassumi] %s da %s", "vocale" if msg.voice else "audio", user.full_name)
            status_msg = await msg.reply_text("⏳ Trascrizione + riassunto…")
            ext = "ogg" if msg.voice else _get_ext(source.file_name, "ogg")
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.file_unique_id}.{ext}"
            audio_path = os.path.join(AUDIO_DIR, filename)
            the_file = await source.get_file()
            await the_file.download_to_drive(audio_path)
            loop = asyncio.get_running_loop()
            text = await loop.run_in_executor(None, get_transcriber().transcribe, audio_path)
            if not text:
                await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                await _del_many(bot, chat_id, msg.message_id)
                await _send_menu(bot, chat_id, context)
                return CHOOSING

        elif msg.text:
            urls = URL_RE.findall(msg.text)
            if urls:
                if not TRANSCRIBER_AVAILABLE:
                    await msg.reply_text("⚠️ Trascrizione link non disponibile. Invia solo testo.", reply_markup=BACK_KB)
                    return SUMMARIZE_WAIT

                url = urls[0]
                logger.info("📝 [Riassumi] Link da %s: %s", user.full_name, url)
                status_msg = await msg.reply_text("⏳ Download + trascrizione + riassunto…")
                loop = asyncio.get_running_loop()
                audio_path = await loop.run_in_executor(None, download_audio, url)
                cleanup_audio = True
                if not audio_path:
                    await status_msg.edit_text("❌ Impossibile scaricare l'audio.")
                    await _del_many(bot, chat_id, msg.message_id)
                    await _send_menu(bot, chat_id, context)
                    return CHOOSING
                text = await loop.run_in_executor(None, get_transcriber().transcribe, audio_path)
                if not text:
                    await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                    await _del_many(bot, chat_id, msg.message_id)
                    await _send_menu(bot, chat_id, context)
                    return CHOOSING
            else:
                text = msg.text.strip()
                logger.info("📝 [Riassumi] Testo da %s — %d car.", user.full_name, len(text))
                status_msg = await msg.reply_text("⏳ Riassunto in corso…")
        else:
            await msg.reply_text("⚠️ Inviami testo, vocale, audio o link.", reply_markup=BACK_KB)
            return SUMMARIZE_WAIT

        # Riassunto con Gemini
        logger.info("⚙️  Gemini — riassunto di %d caratteri", len(text))
        loop = asyncio.get_running_loop()
        summary = await loop.run_in_executor(None, summarize_text, text)

        ids = [msg.message_id]
        if status_msg:
            ids.append(status_msg.message_id)
        await _del_many(bot, chat_id, *ids)

        if not summary:
            await bot.send_message(chat_id=chat_id, text="❌ Riassunto non riuscito.")
        else:
            logger.info("✅ Riassunto — %d caratteri", len(summary))
            escaped = _escape_html(summary)
            chunks = _split_text(escaped, max_len=3900)
            header = "📝 <b>Riassunto</b>\n\n"
            await bot.send_message(
                chat_id=chat_id,
                text=header + _blockquote(chunks[0]),
                parse_mode=ParseMode.HTML,
            )
            for chunk in chunks[1:]:
                await bot.send_message(
                    chat_id=chat_id, text=_blockquote(chunk), parse_mode=ParseMode.HTML,
                )

    except Exception as e:
        logger.exception("💥 [Riassumi] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        if cleanup_audio and audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
