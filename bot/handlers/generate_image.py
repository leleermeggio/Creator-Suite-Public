"""Creator Suite Bot — Generate Image handler (NanoBanana)."""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import ContextTypes

from bot.config import CHOOSING, GENERATE_IMAGE_WAIT, DOWNLOADS_DIR
from bot.keyboards import BACK_KB
from bot.utils import _del_many, _cleanup_downloads_bg
from bot.image_generation import generate_image_nanobanana, validate_image_size

logger = logging.getLogger("bot")


async def generate_image_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mostra istruzioni per generazione immagine."""
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🎨 %s → Genera Immagine", update.effective_user.full_name)

    # Check if user has saved API key
    user_api_key = context.user_data.get("nanobanana_api_key")

    if user_api_key:
        await query.edit_message_text(
            "━━ 🎨 <b>Genera Immagine AI</b> ━━\n\n"
            "Invia una descrizione (prompt) per generare un'immagine.\n\n"
            "<b>Formato:</b>\n"
            "  <code>prompt [w=1024 h=1024]</code>\n\n"
            "<b>Esempio:</b>\n"
            "  <code>un gatto astronauta nello spazio w=1024 h=1536</code>\n\n"
            "✅ API Key salvata. Usa /unset_api per rimuoverla.",
            reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
        )
    else:
        await query.edit_message_text(
            "━━ 🎨 <b>Genera Immagine AI</b> ━━\n\n"
            "Serve una API Key NanoBanana.\n"
            "Ottienila gratis su: <code>nanobananaapi.ai</code>\n\n"
            "<b>Formato:</b>\n"
            "  <code>api: TUA_API_KEY</code>\n"
            "  oppure\n"
            "  <code>api: TUA_API_KEY | prompt: descrizione [w=1024 h=1024]</code>\n\n"
            "<b>Esempio:</b>\n"
            "  <code>api: nb_xxx... | prompt: un gatto astronauta w=1024 h=1024</code>\n\n"
            "💡 L'API Key verrà salvata per le prossime volte.",
            reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
        )
    return GENERATE_IMAGE_WAIT


async def process_generate_image(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora richiesta generazione immagine."""
    from bot.handlers.base import _send_menu

    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot
    status_msg = None

    try:
        text = msg.text.strip()

        # Parse API key if provided
        api_key = None
        prompt = text

        if text.lower().startswith("api:"):
            # Format: api: KEY or api: KEY | prompt: DESCRIPTION
            parts = text.split("|", 1)
            api_key_part = parts[0].strip()
            api_key = api_key_part[4:].strip()  # Remove "api:" prefix

            if len(parts) > 1:
                prompt_part = parts[1].strip()
                if prompt_part.lower().startswith("prompt:"):
                    prompt = prompt_part[7:].strip()
                else:
                    prompt = prompt_part
            else:
                # Only API key provided, ask for prompt
                context.user_data["nanobanana_api_key"] = api_key
                await msg.reply_text(
                    "✅ API Key salvata!\n\n"
                    "Ora invia il prompt per generare l'immagine:\n"
                    "<code>descrizione [w=1024 h=1024]</code>",
                    parse_mode=ParseMode.HTML,
                    reply_markup=BACK_KB,
                )
                logger.info("🎨 %s ha salvato API Key NanoBanana", user.full_name)
                return GENERATE_IMAGE_WAIT

        # Use saved API key if available
        if not api_key:
            api_key = context.user_data.get("nanobanana_api_key")
            if not api_key:
                await msg.reply_text(
                    "⚠️ API Key mancante.\n\n"
                    "Invia prima l'API Key nel formato:\n"
                    "<code>api: TUA_API_KEY</code>\n\n"
                    "Ottienila gratis su nanobananaapi.ai",
                    parse_mode=ParseMode.HTML,
                    reply_markup=BACK_KB,
                )
                return GENERATE_IMAGE_WAIT

        # Parse prompt and dimensions
        width, height = 1024, 1024
        clean_prompt = prompt

        # Extract w= and h= from prompt
        import re
        w_match = re.search(r'w=(\d+)', prompt)
        h_match = re.search(r'h=(\d+)', prompt)

        if w_match:
            width = int(w_match.group(1))
            clean_prompt = re.sub(r'w=\d+', '', clean_prompt)
        if h_match:
            height = int(h_match.group(1))
            clean_prompt = re.sub(r'h=\d+', '', clean_prompt)

        clean_prompt = clean_prompt.strip()
        if not clean_prompt:
            await msg.reply_text(
                "⚠️ Prompt mancante.\n"
                "Invia una descrizione per l'immagine.",
                reply_markup=BACK_KB,
            )
            return GENERATE_IMAGE_WAIT

        # Validate dimensions
        width, height = validate_image_size(width, height)

        logger.info("🎨 [Genera] %s - '%s' (%dx%d)", user.full_name, clean_prompt[:50], width, height)
        status_msg = await msg.reply_text("⏳ Generazione immagine in corso...\n<i>Può richiedere fino a 60 secondi</i>", parse_mode=ParseMode.HTML)
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_PHOTO)

        # Generate image
        loop = asyncio.get_running_loop()
        image_bytes = await loop.run_in_executor(
            None,
            lambda: asyncio.run(generate_image_nanobanana(clean_prompt, api_key, width, height))
        )

        # Save to temp file
        ext = ".png"
        fd, temp_path = tempfile.mkstemp(suffix=ext, dir=DOWNLOADS_DIR)
        os.close(fd)
        with open(temp_path, "wb") as f:
            f.write(image_bytes)

        # Send image
        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        with open(temp_path, "rb") as f:
            await bot.send_photo(
                chat_id=chat_id,
                photo=f,
                caption=f"🎨 <b>Immagine generata</b>\n\n"
                        f"<i>{clean_prompt[:200]}</i>\n\n"
                        f"📐 {width}x{height}",
                parse_mode=ParseMode.HTML,
            )
        logger.info("✅ [Genera] Immagine inviata a %s", user.full_name)

        # Cleanup
        os.remove(temp_path)

    except RuntimeError as e:
        logger.warning("⚠️ [Genera] Errore: %s", e)
        await bot.send_message(chat_id=chat_id, text=f"⚠️ {e}")
    except Exception as e:
        logger.exception("💥 [Genera] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING


async def unset_api_key_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler per /unset_api — rimuove l'API key salvata."""
    if "nanobanana_api_key" in context.user_data:
        del context.user_data["nanobanana_api_key"]
        await update.message.reply_text("✅ API Key rimossa.")
        logger.info("🎨 %s ha rimosso la API Key", update.effective_user.full_name)
    else:
        await update.message.reply_text("ℹ️ Nessuna API Key salvata.")
