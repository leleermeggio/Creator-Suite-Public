"""Creator Suite Bot — Translate handler."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, TRANSLATE_LANG, TRANSLATE_WAIT, AUDIO_DIR
from bot.keyboards import BACK_KB, LANG_KB
from bot.utils import _del_many, _escape_html, _blockquote, _split_text, _cleanup_downloads_bg, _get_ext
from bot.translator import translate_text, LANGUAGES
from bot.transcriber_helper import get_transcriber, TRANSCRIBER_AVAILABLE
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def translate_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra selezione lingua per traduzione."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🌍 %s → Traduci", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🌍 <b>Traduci</b> ━━\n\n"
        "Seleziona la lingua di destinazione:",
        reply_markup=LANG_KB, parse_mode=ParseMode.HTML,
    )
    return TRANSLATE_LANG


async def translate_lang_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Memorizza lingua selezionata."""
    query = update.callback_query
    await query.answer()
    lang_code = query.data.replace("lang_", "")
    context.user_data["target_lang"] = lang_code
    flag, name = LANGUAGES.get(lang_code, ("🌍", lang_code))
    logger.info("🌍 %s → lingua: %s %s", update.effective_user.full_name, flag, name)
    await query.edit_message_text(
        f"━━ 🌍 <b>Traduci → {flag} {name}</b> ━━\n\n"
        "Inviami:\n"
        "  ◦ Testo da tradurre\n"
        "  ◦ Vocale o file audio\n"
        "  ◦ Un link con audio/video\n"
        "  ◦ Un documento di testo",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return TRANSLATE_WAIT


async def process_translate(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora la traduzione di testo, audio o link."""
    from downloader import download_audio
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot
    target_lang = context.user_data.get("target_lang", "en")
    flag, lang_name = LANGUAGES.get(target_lang, ("🌍", target_lang))

    text_to_translate = None
    audio_path = None
    cleanup_audio = False
    status_msg = None

    try:
        if msg.voice or msg.audio:
            if not TRANSCRIBER_AVAILABLE:
                await msg.reply_text("⚠️ Trascrizione non disponibile. Invia solo testo.", reply_markup=BACK_KB)
                return TRANSLATE_WAIT

            source = msg.voice or msg.audio
            logger.info("🌍 [Traduci] %s da %s", "vocale" if msg.voice else "audio", user.full_name)
            status_msg = await msg.reply_text("⏳ Trascrizione + traduzione…")
            ext = "ogg" if msg.voice else _get_ext(source.file_name, "ogg")
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.file_unique_id}.{ext}"
            audio_path = os.path.join(AUDIO_DIR, filename)
            the_file = await source.get_file()
            await the_file.download_to_drive(audio_path)
            loop = asyncio.get_running_loop()
            text_to_translate = await loop.run_in_executor(None, get_transcriber().transcribe, audio_path)
            if not text_to_translate:
                await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                await _del_many(bot, chat_id, msg.message_id)
                await _send_menu(bot, chat_id, context)
                return CHOOSING

        elif msg.document:
            logger.info("🌍 [Traduci] Documento da %s", user.full_name)
            status_msg = await msg.reply_text("⏳ Lettura e traduzione…")
            doc_file = await msg.document.get_file()
            doc_path = os.path.join(os.getenv("DOWNLOADS_DIR", "./downloads"), msg.document.file_name or "doc.txt")
            await doc_file.download_to_drive(doc_path)
            try:
                with open(doc_path, "r", encoding="utf-8", errors="ignore") as f:
                    text_to_translate = f.read().strip()
            finally:
                if os.path.exists(doc_path):
                    os.remove(doc_path)
            if not text_to_translate:
                await status_msg.edit_text("⚠️ Documento vuoto.")
                await _del_many(bot, chat_id, msg.message_id)
                await _send_menu(bot, chat_id, context)
                return CHOOSING

        elif msg.text:
            urls = URL_RE.findall(msg.text)
            if urls:
                if not TRANSCRIBER_AVAILABLE:
                    await msg.reply_text("⚠️ Trascrizione link non disponibile. Invia solo testo.", reply_markup=BACK_KB)
                    return TRANSLATE_WAIT

                url = urls[0]
                logger.info("🌍 [Traduci] Link da %s: %s", user.full_name, url)
                status_msg = await msg.reply_text("⏳ Download + trascrizione + traduzione…")
                loop = asyncio.get_running_loop()
                audio_path = await loop.run_in_executor(None, download_audio, url)
                cleanup_audio = True
                if not audio_path:
                    await status_msg.edit_text("❌ Impossibile scaricare l'audio.")
                    await _del_many(bot, chat_id, msg.message_id)
                    await _send_menu(bot, chat_id, context)
                    return CHOOSING
                text_to_translate = await loop.run_in_executor(None, get_transcriber().transcribe, audio_path)
                if not text_to_translate:
                    await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                    await _del_many(bot, chat_id, msg.message_id)
                    await _send_menu(bot, chat_id, context)
                    return CHOOSING
            else:
                text_to_translate = msg.text.strip()
                logger.info("🌍 [Traduci] Testo da %s — %d car.", user.full_name, len(text_to_translate))
                status_msg = await msg.reply_text(f"⏳ Traduzione in {flag} {lang_name}…")
        else:
            await msg.reply_text("⚠️ Inviami testo, vocale, audio o link.", reply_markup=BACK_KB)
            return TRANSLATE_WAIT

        # Traduzione
        logger.info("⚙️  Traduzione %d car. → %s %s", len(text_to_translate), flag, lang_name)
        loop = asyncio.get_running_loop()
        translated = await loop.run_in_executor(None, translate_text, text_to_translate, target_lang)

        # Pulizia input
        ids = [msg.message_id]
        if status_msg:
            ids.append(status_msg.message_id)
        await _del_many(bot, chat_id, *ids)

        if not translated:
            await bot.send_message(chat_id=chat_id, text="❌ Traduzione fallita.")
        else:
            logger.info("✅ Traduzione — %d caratteri", len(translated))
            escaped = _escape_html(translated)
            chunks = _split_text(escaped, max_len=3800)
            header = f"{flag} <b>Traduzione ({lang_name})</b>\n\n"
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
        logger.exception("💥 [Traduci] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        if cleanup_audio and audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
