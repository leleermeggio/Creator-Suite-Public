"""Creator Suite Bot — OCR handler."""

from __future__ import annotations

import asyncio
import logging
import os

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, OCR_WAIT, DOWNLOADS_DIR
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _blockquote, _split_text, _cleanup_downloads_bg
from bot.gemini_helper import is_gemini_available
from bot.services import ocr_image

logger = logging.getLogger("bot")


async def ocr_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per OCR."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🔍 %s → OCR", update.effective_user.full_name)

    if not is_gemini_available():
        await query.edit_message_text(
            "━━ 🔍 <b>OCR</b> ━━\n\n"
            "⚠️ Funzione non configurata.\n"
            "Imposta <code>GOOGLE_API_KEY</code> nel file .env\n"
            "per abilitare l'OCR con Gemini AI.",
            reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
        )
        return CHOOSING

    await query.edit_message_text(
        "━━ 🔍 <b>OCR — Leggi Immagine</b> ━━\n\n"
        "Inviami una foto o un'immagine\n"
        "ed estrarrò il testo visibile.",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return OCR_WAIT


async def process_ocr(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora OCR su immagine."""
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    image_path = None
    try:
        if msg.photo:
            photo = msg.photo[-1]  # massima risoluzione
            logger.info("🔍 [OCR] Foto da %s", user.full_name)
            status_msg = await msg.reply_text("⏳ Analisi immagine…")
            the_file = await photo.get_file()
            image_path = os.path.join(DOWNLOADS_DIR, f"ocr_{photo.file_unique_id}.jpg")
            await the_file.download_to_drive(image_path)

        elif msg.document:
            doc = msg.document
            mime = doc.mime_type or ""
            if not mime.startswith("image/"):
                await msg.reply_text("⚠️ Inviami un'immagine (foto o file immagine).", reply_markup=BACK_KB)
                return OCR_WAIT
            logger.info("🔍 [OCR] Documento immagine da %s: %s", user.full_name, doc.file_name)
            status_msg = await msg.reply_text("⏳ Analisi immagine…")
            the_file = await doc.get_file()
            image_path = os.path.join(DOWNLOADS_DIR, doc.file_name or "ocr_image.jpg")
            await the_file.download_to_drive(image_path)
        else:
            await msg.reply_text("⚠️ Inviami una foto o un file immagine.", reply_markup=BACK_KB)
            return OCR_WAIT

        loop = asyncio.get_running_loop()
        extracted = await loop.run_in_executor(None, ocr_image, image_path)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not extracted or not extracted.strip():
            await bot.send_message(chat_id=chat_id, text="⚠️ Nessun testo rilevato nell'immagine.")
        else:
            logger.info("✅ [OCR] Estratti %d caratteri", len(extracted))
            escaped = _escape_html(extracted)
            chunks = _split_text(escaped, max_len=3900)
            header = "🔍 <b>Testo estratto</b>\n\n"
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
        logger.exception("💥 [OCR] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
