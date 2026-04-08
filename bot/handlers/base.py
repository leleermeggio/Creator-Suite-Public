"""Creator Suite Bot — Base handlers (start, menu, back)."""

from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes, ConversationHandler

from bot.config import CHOOSING, ALLOWED_USERS
from bot.keyboards import MENU_TEXT, MENU_KB
from bot.utils import _is_group, _check_auth, _del

logger = logging.getLogger("bot")


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handler per /start — mostra il menu principale."""
    if not _check_auth(update, ALLOWED_USERS):
        return ConversationHandler.END

    user = update.effective_user
    chat_id = update.effective_chat.id
    group = _is_group(update)
    logger.info("📋 Menu → %s (%s)%s", user.full_name, user.id, " [gruppo]" if group else "")

    # In chat privata cancella il comando; nei gruppi lo lasciamo
    if update.message and not group:
        await _del(context.bot, chat_id, update.message.message_id)

    # Se c'è già un menu, editalo; altrimenti mandane uno nuovo
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            MENU_TEXT, reply_markup=MENU_KB, parse_mode=ParseMode.HTML,
        )
        context.user_data["menu_msg"] = update.callback_query.message.message_id
    else:
        reply_to = update.message.message_id if group and update.message else None
        await _send_menu(context.bot, chat_id, context, reply_to=reply_to)

    return CHOOSING


async def back_to_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Torna al menu principale."""
    query = update.callback_query
    await query.answer()
    logger.info("↩️  %s → menu", update.effective_user.full_name)
    await query.edit_message_text(
        MENU_TEXT, reply_markup=MENU_KB, parse_mode=ParseMode.HTML,
    )
    context.user_data["menu_msg"] = query.message.message_id
    return CHOOSING


async def _send_menu(bot, chat_id: int, context: ContextTypes.DEFAULT_TYPE | None = None,
                     reply_to: int | None = None) -> None:
    """Mostra il menu principale. Cerca di editare il messaggio menu esistente;
    se non è possibile, ne manda uno nuovo."""
    menu_msg_id = context.user_data.get("menu_msg") if context else None

    if menu_msg_id:
        try:
            await bot.edit_message_text(
                chat_id=chat_id, message_id=menu_msg_id,
                text=MENU_TEXT, reply_markup=MENU_KB, parse_mode=ParseMode.HTML,
            )
            return
        except Exception:
            pass  # messaggio cancellato o non modificabile → ne manda uno nuovo

    sent = await bot.send_message(
        chat_id=chat_id, text=MENU_TEXT,
        reply_markup=MENU_KB, parse_mode=ParseMode.HTML,
        reply_to_message_id=reply_to,
    )
    if context:
        context.user_data["menu_msg"] = sent.message_id
