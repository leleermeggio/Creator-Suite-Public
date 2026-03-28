"""Creator Suite Bot — Convert handler."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, CONVERT_FMT, CONVERT_WAIT, DOWNLOADS_DIR, MAX_UPLOAD_SIZE_MB
from bot.keyboards import BACK_KB, CONVERT_KB
from bot.utils import _del_many, _cleanup_downloads_bg, _get_ext
from bot.services import convert_media, AUDIO_FMTS, VIDEO_FMTS

logger = logging.getLogger("bot")


async def convert_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra opzioni di conversione."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🔄 %s → Converti", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🔄 <b>Converti Formato</b> ━━\n\n"
        "Scegli il formato di destinazione:",
        reply_markup=CONVERT_KB, parse_mode=ParseMode.HTML,
    )
    return CONVERT_FMT


async def convert_fmt_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Memorizza formato selezionato."""
    query = update.callback_query
    await query.answer()
    fmt = query.data.replace("cvt_", "")
    context.user_data["convert_fmt"] = fmt
    logger.info("🔄 %s → formato: .%s", update.effective_user.full_name, fmt)
    emoji = "🎵" if fmt in AUDIO_FMTS else "🎬"
    await query.edit_message_text(
        f"━━ 🔄 <b>Converti → {emoji} .{fmt.upper()}</b> ━━\n\n"
        "Inviami il file da convertire\n"
        "(audio, video, vocale o documento).",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return CONVERT_WAIT


async def process_convert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora conversione file."""
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot
    target_fmt = context.user_data.get("convert_fmt", "mp3")

    input_path = None
    try:
        # Determina sorgente file
        if msg.voice:
            source = msg.voice
            ext = "ogg"
            fname = f"voice_{source.file_unique_id}.ogg"
        elif msg.audio:
            source = msg.audio
            ext = _get_ext(source.file_name, "ogg")
            fname = source.file_name or f"audio.{ext}"
        elif msg.video:
            source = msg.video
            ext = "mp4"
            fname = f"video_{source.file_unique_id}.mp4"
        elif msg.document:
            source = msg.document
            ext = _get_ext(source.file_name, "bin")
            fname = source.file_name or f"file.{ext}"
        elif msg.video_note:
            source = msg.video_note
            ext = "mp4"
            fname = f"videonote_{source.file_unique_id}.mp4"
        else:
            await msg.reply_text("⚠️ Inviami un file audio, video o vocale.", reply_markup=BACK_KB)
            return CONVERT_WAIT

        logger.info("🔄 [Converti] %s da %s → .%s", fname, user.full_name, target_fmt)
        status_msg = await msg.reply_text(f"⏳ Conversione in .{target_fmt.upper()}…")

        input_path = os.path.join(DOWNLOADS_DIR, fname)
        the_file = await source.get_file()
        await the_file.download_to_drive(input_path)

        loop = asyncio.get_running_loop()
        output_path = await loop.run_in_executor(None, convert_media, input_path, target_fmt)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not output_path:
            await bot.send_message(chat_id=chat_id, text="❌ Conversione fallita.")
        else:
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            out_name = Path(output_path).name
            with open(output_path, "rb") as f:
                if size_mb <= MAX_UPLOAD_SIZE_MB and target_fmt in AUDIO_FMTS:
                    await bot.send_audio(
                        chat_id=chat_id, audio=f, filename=out_name,
                    )
                elif size_mb <= MAX_UPLOAD_SIZE_MB and target_fmt in VIDEO_FMTS:
                    await bot.send_video(
                        chat_id=chat_id, video=f,
                        supports_streaming=True, filename=out_name,
                    )
                else:
                    await bot.send_document(chat_id=chat_id, document=f, filename=out_name)
            logger.info("✅ [Converti] %s → %s (%.1f MB)", fname, out_name, size_mb)

    except Exception as e:
        logger.exception("💥 [Converti] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
