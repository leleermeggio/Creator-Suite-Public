"""Creator Suite Bot — Jump Cut handler."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, JUMPCUT_WAIT, DOWNLOADS_DIR, MAX_UPLOAD_SIZE_MB, JUMPCUT_SILENCE_THRESH, JUMPCUT_MIN_SILENCE, JUMPCUT_PADDING
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _cleanup_downloads_bg, _fmt_duration
from bot.jumpcut import process_jumpcut, check_ffmpeg, JumpCutResult

logger = logging.getLogger("bot")


async def jumpcut_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per Jump Cut."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("✂️ %s → Jump Cut", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ ✂️ <b>Jump Cut Automatico</b> ━━\n\n"
        "Inviami un video e rimuoverò\n"
        "automaticamente i momenti di silenzio.\n\n"
        "  ◦ Video diretto o video-nota\n"
        "  ◦ File video (MP4, MKV, …)\n\n"
        "💡 <i>Usa /jumpcut_help per i dettagli</i>",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return JUMPCUT_WAIT


async def process_jumpcut_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora Jump Cut su video."""
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    input_path = None
    try:
        # Determina sorgente video
        if msg.video:
            source = msg.video
            fname = source.file_name or f"video_{source.file_unique_id}.mp4"
        elif msg.video_note:
            source = msg.video_note
            fname = f"videonote_{source.video_note.file_unique_id}.mp4"
        elif msg.document:
            mime = (msg.document.mime_type or "")
            if not mime.startswith("video/"):
                await msg.reply_text(
                    "⚠️ Inviami un file video (MP4, MKV, …).",
                    reply_markup=BACK_KB,
                )
                return JUMPCUT_WAIT
            source = msg.document
            fname = source.file_name or f"doc_{source.file_unique_id}.mp4"
        else:
            await msg.reply_text(
                "⚠️ Inviami un video, un video-nota o un file video.",
                reply_markup=BACK_KB,
            )
            return JUMPCUT_WAIT

        size_mb = (source.file_size or 0) / (1024 * 1024)
        logger.info("✂️ [JumpCut] %s da %s — %.1f MB", fname, user.full_name, size_mb)
        status_msg = await msg.reply_text("⏳ Download del video…")

        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_VIDEO)

        input_path = os.path.join(DOWNLOADS_DIR, fname)
        the_file = await source.get_file()
        await the_file.download_to_drive(input_path)

        await status_msg.edit_text("✂️ Analisi silenzi e taglio in corso…\n"
                                   "<i>Potrebbe richiedere qualche minuto.</i>",
                                   parse_mode=ParseMode.HTML)

        loop = asyncio.get_running_loop()
        result: JumpCutResult = await loop.run_in_executor(
            None, process_jumpcut, input_path, DOWNLOADS_DIR,
        )

        # Pulizia messaggi
        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if result.error:
            logger.warning("⚠️ [JumpCut] %s", result.error)
            await bot.send_message(chat_id=chat_id, text=f"⚠️ {result.error}")
        elif not result.output_path or not os.path.exists(result.output_path):
            await bot.send_message(chat_id=chat_id, text="❌ Elaborazione fallita.")
        else:
            out_size_mb = os.path.getsize(result.output_path) / (1024 * 1024)
            # Statistiche
            stats = (
                f"✂️ <b>Jump Cut completato</b>\n\n"
                f"⏱ Originale: <b>{_fmt_duration(result.original_duration)}</b>\n"
                f"⏱ Finale: <b>{_fmt_duration(result.final_duration)}</b>\n"
                f"📉 Rimosso: <b>{result.removed_pct:.1f}%</b>\n"
                f"🧩 Segmenti: <b>{result.segments_count}</b>"
            )
            await bot.send_message(
                chat_id=chat_id, text=stats, parse_mode=ParseMode.HTML,
            )
            with open(result.output_path, "rb") as f:
                if out_size_mb <= MAX_UPLOAD_SIZE_MB:
                    await bot.send_video(
                        chat_id=chat_id, video=f,
                        supports_streaming=True,
                        filename=Path(result.output_path).name,
                    )
                else:
                    await bot.send_document(
                        chat_id=chat_id, document=f,
                        filename=Path(result.output_path).name,
                    )
            logger.info("✅ [JumpCut] Inviato — %.1fs → %.1fs (%.1f%%, %.1f MB)",
                        result.original_duration, result.final_duration,
                        result.removed_pct, out_size_mb)

    except Exception as e:
        logger.exception("💥 [JumpCut] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING


async def jumpcut_help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler per /jumpcut_help — spiega il funzionamento del jump cut."""
    help_text = (
        "✂️ <b>Jump Cut Automatico — Guida</b>\n\n"
        "Questa funzione rimuove automaticamente i momenti\n"
        "di silenzio da un video, creando un montaggio\n"
        "più serrato e dinamico.\n\n"
        "<b>Come usarlo:</b>\n"
        "  1. Premi <b>✂️ Jump Cut</b> dal menu\n"
        "  2. Invia un video (file, video-nota, ecc.)\n"
        "  3. Attendi l'elaborazione\n"
        "  4. Ricevi il video tagliato + statistiche\n\n"
        "<b>Parametri (configurabili):</b>\n"
        f"  ◦ Soglia silenzio: <code>{JUMPCUT_SILENCE_THRESH} dB</code>\n"
        f"  ◦ Durata minima silenzio: <code>{JUMPCUT_MIN_SILENCE}s</code>\n"
        f"  ◦ Padding attorno parole: <code>{JUMPCUT_PADDING}s</code>\n\n"
        "<b>Note:</b>\n"
        "  ◦ Il video deve contenere una traccia audio\n"
        "  ◦ Limite file Telegram: 50 MB\n"
        "  ◦ Video molto lunghi richiedono più tempo"
    )
    await update.message.reply_text(help_text, parse_mode=ParseMode.HTML, reply_markup=BACK_KB)
