"""Creator Suite Bot — Transcribe handler."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, TRANSCRIBE_WAIT, AUDIO_DIR
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _blockquote, _split_text, _cleanup_downloads_bg, _get_ext

logger = logging.getLogger("bot")


async def transcribe_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per la trascrizione."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🎙️ %s → Trascrivi", update.effective_user.full_name)

    await query.edit_message_text(
        "━━ 🎙 <b>Trascrivi Audio</b> ━━\n\n"
        "Inviami:\n"
        "  ◦ Un messaggio vocale\n"
        "  ◦ Un file audio\n"
        "  ◦ Un link (YouTube, TikTok…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return TRANSCRIBE_WAIT


async def process_transcribe(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora la trascrizione di audio o link."""
    from bot.utils import URL_RE
    from bot.downloader import download_audio
    from bot.handlers.base import _send_menu
    from bot.transcriber_helper import get_transcriber

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot
    audio_path = None
    cleanup_audio = False
    status_msg = None

    try:
        if msg.voice or msg.audio:
            source = msg.voice or msg.audio
            duration = source.duration or 0
            size_mb = (source.file_size or 0) / (1024 * 1024)
            logger.info("🎙️ [Trascrivi] %s da %s — %ds, %.1f MB",
                        "vocale" if msg.voice else "audio", user.full_name, duration, size_mb)
            status_msg = await msg.reply_text("⏳ Trascrizione in corso…")
            ext = "ogg" if msg.voice else _get_ext(source.file_name, "ogg")
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.file_unique_id}.{ext}"
            audio_path = os.path.join(AUDIO_DIR, filename)
            the_file = await source.get_file()
            await the_file.download_to_drive(audio_path)

        elif msg.text:
            urls = URL_RE.findall(msg.text)
            if not urls:
                await msg.reply_text("⚠️ Inviami un link, un vocale o un file audio.", reply_markup=BACK_KB)
                return TRANSCRIBE_WAIT
            url = urls[0]
            logger.info("🎙️ [Trascrivi] Link da %s: %s", user.full_name, url)
            status_msg = await msg.reply_text("⏳ Download e trascrizione…")
            loop = asyncio.get_running_loop()
            audio_path = await loop.run_in_executor(None, download_audio, url)
            cleanup_audio = True
            if not audio_path:
                await status_msg.edit_text("❌ Impossibile scaricare l'audio dal link.")
                await _del_many(bot, chat_id, msg.message_id)
                from base import _send_menu
                await _send_menu(bot, chat_id, context)
                return CHOOSING
        else:
            await msg.reply_text("⚠️ Inviami un link, un vocale o un file audio.", reply_markup=BACK_KB)
            return TRANSCRIBE_WAIT

        # Trascrizione
        if status_msg:
            await status_msg.edit_text("⚙️ Whisper in esecuzione…")
        logger.info("⚙️  Whisper in esecuzione…")
        loop = asyncio.get_running_loop()
        transcriber = get_transcriber()
        transcript = await loop.run_in_executor(None, transcriber.transcribe, audio_path)

        # Cancella input + status
        ids = [msg.message_id]
        if status_msg:
            ids.append(status_msg.message_id)
        await _del_many(bot, chat_id, *ids)

        # Risultato
        if not transcript:
            logger.warning("⚠️  Trascrizione vuota")
            await bot.send_message(chat_id=chat_id, text="⚠️ Nessun parlato rilevato.")
        else:
            logger.info("✅ Trascrizione — %d caratteri", len(transcript))
            escaped = _escape_html(transcript)
            chunks = _split_text(escaped, max_len=3900)
            header = "📝 <b>Trascrizione</b>\n\n"
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
        logger.exception("💥 [Trascrivi] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        if cleanup_audio and audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        _cleanup_downloads_bg()

    from base import _send_menu
    await _send_menu(bot, chat_id, context)
    return CHOOSING
