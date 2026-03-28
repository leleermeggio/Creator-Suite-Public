"""Creator Suite Bot — Images handler."""

from __future__ import annotations

import asyncio
import logging

from telegram import Update, InputMediaPhoto, InputMediaVideo
from telegram.constants import ChatAction, ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, IMAGES_WAIT, _IMAGE_EXT, _VIDEO_EXT
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _escape_html, _cleanup_downloads_bg
from bot.utils import URL_RE

logger = logging.getLogger("bot")


async def images_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per scaricare immagini."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🖼  %s → Immagini", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🖼 <b>Scarica Immagini</b> ━━\n\n"
        "Inviami il link del post\n"
        "(Instagram, Twitter, Facebook…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return IMAGES_WAIT


async def process_images(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Scarica immagini da un link."""
    from pathlib import Path
    from bot.downloader import download_images
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return IMAGES_WAIT

    url = urls[0]
    logger.info("🖼  [Immagini] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Scaricamento in corso…")

    try:
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_PHOTO)
        loop = asyncio.get_running_loop()
        files, caption = await loop.run_in_executor(None, download_images, url)

        # Pulizia input
        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not files:
            logger.warning("⚠️  Nessun file trovato")
            await bot.send_message(chat_id=chat_id, text="⚠️ Nessuna immagine trovata.")
        else:
            # Costruisci lista media (foto + video insieme)
            media_items = []
            others = []
            for f in files:
                ext = Path(f).suffix.lower()
                if ext in _IMAGE_EXT:
                    media_items.append(("photo", f))
                elif ext in _VIDEO_EXT:
                    media_items.append(("video", f))
                else:
                    others.append(f)

            logger.info("📦 [Immagini] %d media, %d altro", len(media_items), len(others))

            # Componi caption: link + testo originale
            parts = [f'🔗 <a href="{_escape_html(url)}">Fonte</a>']
            if caption:
                parts.append(caption)
            full_caption = "\n\n".join(parts)
            safe_caption = full_caption[:1024] if full_caption else None
            parse = ParseMode.HTML if safe_caption else None

            # Album unico (max 10 per gruppo)
            for batch_start in range(0, len(media_items), 10):
                batch = media_items[batch_start:batch_start + 10]
                media_group = []
                for i, (mtype, fpath) in enumerate(batch):
                    data = Path(fpath).read_bytes()
                    cap = safe_caption if (batch_start == 0 and i == 0) else None
                    pm = parse if cap else None
                    if mtype == "photo":
                        media_group.append(InputMediaPhoto(media=data, caption=cap, parse_mode=pm))
                    else:
                        media_group.append(InputMediaVideo(media=data, caption=cap, parse_mode=pm, supports_streaming=True))
                await bot.send_media_group(chat_id=chat_id, media=media_group)
                logger.info("   📸 Album inviato — %d elementi", len(batch))

            for other_path in others:
                with open(other_path, "rb") as f:
                    await bot.send_document(chat_id=chat_id, document=f)

            logger.info("✅ [Immagini] Invio completato")

    except Exception as e:
        logger.exception("💥 [Immagini] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING
