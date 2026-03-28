"""Caz_zoneBot — Bot Telegram multifunzione con menu contestuali."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import signal
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
    InputMediaVideo,
    Update,
)
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

try:
    from transcriber import WhisperTranscriber
    _TRANSCRIBER_AVAILABLE = True
except ImportError:
    WhisperTranscriber = None  # type: ignore
    _TRANSCRIBER_AVAILABLE = False
from translator import translate_text, LANGUAGES
from downloader import (
    download_mp3, download_images, download_audio,
    download_video, get_link_info,
)
from services import (
    summarize_text, ocr_image, gemini_available,
    text_to_speech, convert_media,
    CONVERT_FORMATS, AUDIO_FMTS, VIDEO_FMTS,
)
from jumpcut import process_jumpcut, check_ffmpeg, JumpCutResult

# ---------------------------------------------------------------------------
# Configurazione
# ---------------------------------------------------------------------------
TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
ALLOWED_USERS = {
    int(uid.strip())
    for uid in os.getenv("ALLOWED_USERS", "").split(",")
    if uid.strip()
}
DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR", "/app/downloads")
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")
LOG_DIR = os.getenv("LOG_DIR", "/app/logs")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
TRANSCRIBE_LANGUAGE = os.getenv("TRANSCRIBE_LANGUAGE", "it")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, "bot.log")),
    ],
)
for noisy in ("httpx", "httpcore", "telegram.ext", "urllib3"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

logger = logging.getLogger("bot")

# ---------------------------------------------------------------------------
# Whisper — caricato lazy al primo utilizzo (se disponibile)
# ---------------------------------------------------------------------------
_transcriber: "WhisperTranscriber | None" = None


def _get_transcriber() -> "WhisperTranscriber":
    global _transcriber
    if not _TRANSCRIBER_AVAILABLE:
        raise RuntimeError("Whisper non disponibile. Installa torch e openai-whisper.")
    if _transcriber is None:
        _transcriber = WhisperTranscriber(WHISPER_MODEL, TRANSCRIBE_LANGUAGE)
    return _transcriber

# ---------------------------------------------------------------------------
# Conversation states
# ---------------------------------------------------------------------------
(CHOOSING, TRANSCRIBE_WAIT, TRANSLATE_LANG, TRANSLATE_WAIT,
 IMAGES_WAIT, MP3_WAIT, VIDEO_WAIT, SUMMARIZE_WAIT,
 OCR_WAIT, INFO_WAIT, TTS_WAIT, CONVERT_FMT, CONVERT_WAIT,
 JUMPCUT_WAIT) = range(14)

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
_VIDEO_EXT = {".mp4", ".mkv", ".webm", ".avi", ".mov"}

# ---------------------------------------------------------------------------
# Tastiere inline
# ---------------------------------------------------------------------------
MENU_TEXT = (
    "━━━━━━━━━━━━━━━━━━━━\n"
    "  🤖  <b>Caz_zoneBot</b>\n"
    "━━━━━━━━━━━━━━━━━━━━\n\n"
    "Il tuo assistente multifunzione:\n"
    "trascrivi, traduci, scarica media,\n"
    "riassumi, converti e molto altro.\n\n"
    "⬇️ Scegli un'azione:"
)

MENU_KB = InlineKeyboardMarkup([
    [InlineKeyboardButton("🎙  Trascrivi", callback_data="transcribe"),
     InlineKeyboardButton("🌍  Traduci", callback_data="translate")],
    [InlineKeyboardButton("🖼  Immagini", callback_data="images"),
     InlineKeyboardButton("📹  Video", callback_data="video")],
    [InlineKeyboardButton("🎵  MP3", callback_data="mp3"),
     InlineKeyboardButton("🔄  Converti", callback_data="convert")],
    [InlineKeyboardButton("📝  Riassumi", callback_data="summarize"),
     InlineKeyboardButton("🔍  OCR", callback_data="ocr")],
    [InlineKeyboardButton("📊  Info Link", callback_data="info"),
     InlineKeyboardButton("🗣️  TTS", callback_data="tts")],
    [InlineKeyboardButton("✂️  Jump Cut", callback_data="jumpcut")],
])

BACK_KB = InlineKeyboardMarkup([
    [InlineKeyboardButton("↩️  Indietro", callback_data="back")],
])


def _lang_keyboard() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    items = list(LANGUAGES.items())
    for i in range(0, len(items), 3):
        row = []
        for code, (flag, name) in items[i:i + 3]:
            row.append(InlineKeyboardButton(f"{flag} {name}", callback_data=f"lang_{code}"))
        rows.append(row)
    rows.append([InlineKeyboardButton("↩️  Indietro", callback_data="back")])
    return InlineKeyboardMarkup(rows)


LANG_KB = _lang_keyboard()


def _convert_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎵 MP3", callback_data="cvt_mp3"),
         InlineKeyboardButton("🎵 WAV", callback_data="cvt_wav"),
         InlineKeyboardButton("🎵 OGG", callback_data="cvt_ogg")],
        [InlineKeyboardButton("🎵 FLAC", callback_data="cvt_flac"),
         InlineKeyboardButton("🎵 AAC", callback_data="cvt_aac"),
         InlineKeyboardButton("🎵 M4A", callback_data="cvt_m4a")],
        [InlineKeyboardButton("🎬 MP4", callback_data="cvt_mp4"),
         InlineKeyboardButton("🎬 MKV", callback_data="cvt_mkv"),
         InlineKeyboardButton("🎬 WebM", callback_data="cvt_webm")],
        [InlineKeyboardButton("↩️  Indietro", callback_data="back")],
    ])


CONVERT_KB = _convert_keyboard()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_group(update: Update) -> bool:
    """True se la chat è un gruppo o supergruppo."""
    return update.effective_chat.type in ("group", "supergroup")


def _check_auth(update: Update) -> bool:
    user = update.effective_user
    if ALLOWED_USERS and user.id not in ALLOWED_USERS:
        logger.warning("⛔ Accesso negato — %s (%s)", user.full_name, user.id)
        return False
    return True


async def _del(bot, chat_id: int, msg_id: int) -> None:
    try:
        await bot.delete_message(chat_id=chat_id, message_id=msg_id)
    except Exception:
        pass


async def _del_many(bot, chat_id: int, *msg_ids: int) -> None:
    """Cancella più messaggi in parallelo."""
    tasks = [_del(bot, chat_id, mid) for mid in msg_ids if mid]
    if tasks:
        await asyncio.gather(*tasks)


def _cleanup_downloads_bg() -> None:
    """Lancia cleanup in un thread background per non bloccare la risposta."""
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _cleanup_downloads)


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


def _get_ext(filename: str | None, default: str = "ogg") -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _blockquote(html_text: str, max_lines: int = 10) -> str:
    line_count = html_text.count("\n") + 1
    tag = "blockquote expandable" if line_count > max_lines else "blockquote"
    return f"<{tag}>{html_text}</{tag.split()[0]}>"


def _split_text(text: str, max_len: int = 4000) -> list[str]:
    if len(text) <= max_len:
        return [text]
    chunks: list[str] = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        split_at = text.rfind("\n", 0, max_len)
        if split_at == -1:
            split_at = text.rfind(" ", 0, max_len)
        if split_at == -1:
            split_at = max_len
        chunks.append(text[:split_at])
        text = text[split_at:].lstrip()
    return chunks


def _cleanup_downloads():
    dl_path = Path(DOWNLOADS_DIR)
    if dl_path.exists():
        for f in dl_path.iterdir():
            try:
                if f.is_file():
                    f.unlink()
                elif f.is_dir():
                    shutil.rmtree(f)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# /start → menu principale (unico comando)
# ---------------------------------------------------------------------------
async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not _check_auth(update):
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
    query = update.callback_query
    await query.answer()
    logger.info("↩️  %s → menu", update.effective_user.full_name)
    await query.edit_message_text(
        MENU_TEXT, reply_markup=MENU_KB, parse_mode=ParseMode.HTML,
    )
    context.user_data["menu_msg"] = query.message.message_id
    return CHOOSING


# ===================================================================
# 🎙 TRASCRIVI AUDIO
# ===================================================================
async def transcribe_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🎙️ %s → Trascrivi", update.effective_user.full_name)

    if not _TRANSCRIBER_AVAILABLE:
        await query.edit_message_text(
            "━━ 🎙 <b>Trascrivi Audio</b> ━━\n\n"
            "⚠️ Funzione non disponibile.\n"
            "Il modulo Whisper non è installato.\n\n"
            "Contatta l'amministratore per attivare la trascrizione.",
            reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
        )
        return CHOOSING

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
        transcript = await loop.run_in_executor(None, _get_transcriber().transcribe, audio_path)

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

    await _send_menu(bot, chat_id, context)
    return CHOOSING


# ===================================================================
# 🌍 TRADUCI
# ===================================================================
async def translate_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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
            source = msg.voice or msg.audio
            logger.info("🌍 [Traduci] %s da %s", "vocale" if msg.voice else "audio", user.full_name)
            status_msg = await msg.reply_text("⏳ Trascrizione + traduzione…")
            ext = "ogg" if msg.voice else _get_ext(source.file_name, "ogg")
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.file_unique_id}.{ext}"
            audio_path = os.path.join(AUDIO_DIR, filename)
            the_file = await source.get_file()
            await the_file.download_to_drive(audio_path)
            loop = asyncio.get_running_loop()
            text_to_translate = await loop.run_in_executor(None, _get_transcriber().transcribe, audio_path)
            if not text_to_translate:
                await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                await _del_many(bot, chat_id, msg.message_id)
                await _send_menu(bot, chat_id, context)
                return CHOOSING

        elif msg.document:
            logger.info("🌍 [Traduci] Documento da %s", user.full_name)
            status_msg = await msg.reply_text("⏳ Lettura e traduzione…")
            doc_file = await msg.document.get_file()
            doc_path = os.path.join(DOWNLOADS_DIR, msg.document.file_name or "doc.txt")
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
                text_to_translate = await loop.run_in_executor(None, _get_transcriber().transcribe, audio_path)
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


# ===================================================================
# 🖼 SCARICA IMMAGINI
# ===================================================================
async def images_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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
            parts = [f"🔗 <a href=\"{_escape_html(url)}\">Fonte</a>"]
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


# ===================================================================
# 🎵 SCARICA MP3
# ===================================================================
async def mp3_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🎵 %s → MP3", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 🎵 <b>Scarica MP3</b> ━━\n\n"
        "Inviami il link del video\n"
        "(YouTube, TikTok, Instagram…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return MP3_WAIT


async def process_mp3(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return MP3_WAIT

    url = urls[0]
    logger.info("🎵 [MP3] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Estrazione audio…")

    try:
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_DOCUMENT)
        loop = asyncio.get_running_loop()
        mp3_path, title, uploader = await loop.run_in_executor(None, download_mp3, url)

        # Pulizia input
        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not mp3_path:
            logger.warning("⚠️  Download MP3 fallito")
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile estrarre l'audio.")
        else:
            size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
            logger.info("📦 [MP3] %s — %.1f MB", Path(mp3_path).name, size_mb)
            with open(mp3_path, "rb") as f:
                if size_mb <= 50:
                    await bot.send_audio(
                        chat_id=chat_id, audio=f,
                        title=title or None,
                        performer=uploader or None,
                        filename=f"{title or 'audio'}.mp3",
                    )
                else:
                    await bot.send_document(
                        chat_id=chat_id, document=f,
                        filename=f"{title or 'audio'}.mp3",
                    )
            logger.info("✅ [MP3] Inviato: %s", title)

    except Exception as e:
        logger.exception("💥 [MP3] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING


# ===================================================================
# 📹 SCARICA VIDEO
# ===================================================================
async def video_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📹 %s → Video", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 📹 <b>Scarica Video</b> ━━\n\n"
        "Inviami il link del video\n"
        "(YouTube, TikTok, Instagram…)",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return VIDEO_WAIT


async def process_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return VIDEO_WAIT

    url = urls[0]
    logger.info("📹 [Video] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Download video in corso…")

    try:
        await bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_VIDEO)
        loop = asyncio.get_running_loop()
        video_path, title = await loop.run_in_executor(None, download_video, url)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not video_path:
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile scaricare il video.")
        else:
            size_mb = os.path.getsize(video_path) / (1024 * 1024)
            logger.info("📦 [Video] %s — %.1f MB", Path(video_path).name, size_mb)
            with open(video_path, "rb") as f:
                if size_mb <= 50:
                    await bot.send_video(
                        chat_id=chat_id, video=f,
                        caption=f"🎬 <b>{_escape_html(title or 'Video')}</b>",
                        parse_mode=ParseMode.HTML,
                        supports_streaming=True,
                    )
                else:
                    await bot.send_document(
                        chat_id=chat_id, document=f,
                        caption=f"🎬 <b>{_escape_html(title or 'Video')}</b>",
                        parse_mode=ParseMode.HTML,
                    )
            logger.info("✅ [Video] Inviato: %s", title)

    except Exception as e:
        logger.exception("💥 [Video] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")
    finally:
        _cleanup_downloads_bg()

    await _send_menu(bot, chat_id, context)
    return CHOOSING


# ===================================================================
# 📝 RIASSUMI
# ===================================================================
async def summarize_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📝 %s → Riassumi", update.effective_user.full_name)

    if not gemini_available():
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
            source = msg.voice or msg.audio
            logger.info("📝 [Riassumi] %s da %s", "vocale" if msg.voice else "audio", user.full_name)
            status_msg = await msg.reply_text("⏳ Trascrizione + riassunto…")
            ext = "ogg" if msg.voice else _get_ext(source.file_name, "ogg")
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.file_unique_id}.{ext}"
            audio_path = os.path.join(AUDIO_DIR, filename)
            the_file = await source.get_file()
            await the_file.download_to_drive(audio_path)
            loop = asyncio.get_running_loop()
            text = await loop.run_in_executor(None, _get_transcriber().transcribe, audio_path)
            if not text:
                await status_msg.edit_text("⚠️ Nessun parlato rilevato.")
                await _del_many(bot, chat_id, msg.message_id)
                await _send_menu(bot, chat_id, context)
                return CHOOSING

        elif msg.text:
            urls = URL_RE.findall(msg.text)
            if urls:
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
                text = await loop.run_in_executor(None, _get_transcriber().transcribe, audio_path)
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


# ===================================================================
# 🔍 OCR (Leggi Immagine)
# ===================================================================
async def ocr_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("🔍 %s → OCR", update.effective_user.full_name)

    if not gemini_available():
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


# ===================================================================
# 📊 INFO LINK
# ===================================================================
async def info_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["menu_msg"] = query.message.message_id
    logger.info("📊 %s → Info Link", update.effective_user.full_name)
    await query.edit_message_text(
        "━━ 📊 <b>Info Link</b> ━━\n\n"
        "Inviami un link e ti mostrerò\n"
        "titolo, autore, durata, visualizzazioni…",
        reply_markup=BACK_KB, parse_mode=ParseMode.HTML,
    )
    return INFO_WAIT


async def process_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    msg = update.message
    chat_id = msg.chat_id
    bot = context.bot

    urls = URL_RE.findall(msg.text or "")
    if not urls:
        await msg.reply_text("⚠️ Inviami un link valido.", reply_markup=BACK_KB)
        return INFO_WAIT

    url = urls[0]
    logger.info("📊 [Info] Link da %s: %s", user.full_name, url)
    status_msg = await msg.reply_text("⏳ Analisi link…")

    try:
        loop = asyncio.get_running_loop()
        info = await loop.run_in_executor(None, get_link_info, url)

        await _del_many(bot, chat_id, msg.message_id, status_msg.message_id)

        if not info:
            await bot.send_message(chat_id=chat_id, text="❌ Impossibile analizzare il link.")
        else:
            lines = ["📊 <b>Info Link</b>\n"]
            if info.get("title"):
                lines.append(f"📌 <b>Titolo:</b> {_escape_html(info['title'])}")
            if info.get("uploader"):
                lines.append(f"👤 <b>Autore:</b> {_escape_html(info['uploader'])}")
            if info.get("duration"):
                dur = info["duration"]
                m, s = divmod(int(dur), 60)
                h, m = divmod(m, 60)
                dur_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
                lines.append(f"⏱ <b>Durata:</b> {dur_str}")
            if info.get("view_count"):
                lines.append(f"👁 <b>Visualizzazioni:</b> {info['view_count']:,}".replace(",", "."))
            if info.get("like_count"):
                lines.append(f"❤️ <b>Like:</b> {info['like_count']:,}".replace(",", "."))
            if info.get("upload_date"):
                d = info["upload_date"]
                if len(d) == 8:
                    lines.append(f"📅 <b>Data:</b> {d[6:8]}/{d[4:6]}/{d[:4]}")
            if info.get("description"):
                desc = _escape_html(info["description"][:300])
                lines.append(f"\n📝 <b>Descrizione:</b>\n{_blockquote(desc)}")

            text = "\n".join(lines)
            await bot.send_message(chat_id=chat_id, text=text, parse_mode=ParseMode.HTML)
            logger.info("✅ [Info] Inviato per: %s", info.get("title", "?"))

    except Exception as e:
        logger.exception("💥 [Info] %s", e)
        await bot.send_message(chat_id=chat_id, text=f"❌ Errore: {e}")

    await _send_menu(bot, chat_id, context)
    return CHOOSING


# ===================================================================
# 🗣️ TEXT-TO-SPEECH
# ===================================================================
async def tts_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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


# ===================================================================
# 🔄 CONVERTI FORMATO
# ===================================================================
async def convert_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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
                if size_mb <= 50 and target_fmt in AUDIO_FMTS:
                    await bot.send_audio(
                        chat_id=chat_id, audio=f, filename=out_name,
                    )
                elif size_mb <= 50 and target_fmt in VIDEO_FMTS:
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


# ===================================================================
# ✂️ JUMP CUT (rimozione silenzi)
# ===================================================================
async def jumpcut_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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


def _fmt_duration(seconds: float) -> str:
    """Formatta durata in mm:ss o hh:mm:ss."""
    s = int(seconds)
    if s >= 3600:
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}"
    m, sec = divmod(s, 60)
    return f"{m}:{sec:02d}"


async def process_jumpcut_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
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
            fname = f"videonote_{source.file_unique_id}.mp4"
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
                if out_size_mb <= 50:
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
        f"  ◦ Soglia silenzio: <code>{os.getenv('JUMPCUT_SILENCE_THRESH', '-35')} dB</code>\n"
        f"  ◦ Durata minima silenzio: <code>{os.getenv('JUMPCUT_MIN_SILENCE', '0.4')}s</code>\n"
        f"  ◦ Padding attorno parole: <code>{os.getenv('JUMPCUT_PADDING', '0.1')}s</code>\n\n"
        "<b>Note:</b>\n"
        "  ◦ Il video deve contenere una traccia audio\n"
        "  ◦ Limite file Telegram: 50 MB\n"
        "  ◦ Video molto lunghi richiedono più tempo"
    )
    await update.message.reply_text(help_text, parse_mode=ParseMode.HTML)


# ===================================================================
# Post-init & Main
# ===================================================================
async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([
        BotCommand("start", "Creator Suite"),
    ])
    logger.info("📝 Comando registrato: /start - Creator Suite")


def main():
    logger.info("🚀 Avvio Caz_zoneBot…")
    logger.info("👥 Utenti autorizzati: %s", ALLOWED_USERS or "TUTTI")
    logger.info("📂 Downloads: %s | Audio: %s | Log: %s", DOWNLOADS_DIR, AUDIO_DIR, LOG_DIR)

    if check_ffmpeg():
        logger.info("✅ ffmpeg trovato")
    else:
        logger.warning("⚠️ ffmpeg NON trovato — Jump Cut e Converti non funzioneranno")

    logger.info("👥 Supporto gruppi attivo — disabilita Privacy Mode via @BotFather per uso completo nei gruppi")

    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    conv = ConversationHandler(
        per_message=False,
        entry_points=[
            CommandHandler("start", start_cmd),
            CommandHandler("menu", start_cmd),
        ],
        states={
            CHOOSING: [
                CallbackQueryHandler(transcribe_selected, pattern="^transcribe$"),
                CallbackQueryHandler(translate_selected, pattern="^translate$"),
                CallbackQueryHandler(images_selected, pattern="^images$"),
                CallbackQueryHandler(video_selected, pattern="^video$"),
                CallbackQueryHandler(mp3_selected, pattern="^mp3$"),
                CallbackQueryHandler(convert_selected, pattern="^convert$"),
                CallbackQueryHandler(summarize_selected, pattern="^summarize$"),
                CallbackQueryHandler(ocr_selected, pattern="^ocr$"),
                CallbackQueryHandler(info_selected, pattern="^info$"),
                CallbackQueryHandler(tts_selected, pattern="^tts$"),
                CallbackQueryHandler(jumpcut_selected, pattern="^jumpcut$"),
            ],
            TRANSCRIBE_WAIT: [
                MessageHandler(
                    (filters.VOICE | filters.AUDIO | filters.TEXT) & ~filters.COMMAND,
                    process_transcribe,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            TRANSLATE_LANG: [
                CallbackQueryHandler(translate_lang_selected, pattern="^lang_"),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            TRANSLATE_WAIT: [
                MessageHandler(
                    (filters.TEXT | filters.VOICE | filters.AUDIO | filters.Document.ALL)
                    & ~filters.COMMAND,
                    process_translate,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            IMAGES_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_images),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            MP3_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_mp3),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            VIDEO_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_video),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            SUMMARIZE_WAIT: [
                MessageHandler(
                    (filters.VOICE | filters.AUDIO | filters.TEXT) & ~filters.COMMAND,
                    process_summarize,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            OCR_WAIT: [
                MessageHandler(
                    (filters.PHOTO | filters.Document.ALL) & ~filters.COMMAND,
                    process_ocr,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            INFO_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_info),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            TTS_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_tts),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            CONVERT_FMT: [
                CallbackQueryHandler(convert_fmt_selected, pattern="^cvt_"),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            CONVERT_WAIT: [
                MessageHandler(
                    (filters.VOICE | filters.AUDIO | filters.VIDEO | filters.VIDEO_NOTE
                     | filters.Document.ALL) & ~filters.COMMAND,
                    process_convert,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
            JUMPCUT_WAIT: [
                MessageHandler(
                    (filters.VIDEO | filters.VIDEO_NOTE | filters.Document.ALL)
                    & ~filters.COMMAND,
                    process_jumpcut_video,
                ),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
        },
        fallbacks=[
            CommandHandler("start", start_cmd),
            CommandHandler("menu", start_cmd),
        ],
    )

    app.add_handler(conv)
    app.add_handler(CommandHandler("jumpcut_help", jumpcut_help_cmd))
    # Nota: /menu è già gestito dentro conv (entry_points + fallbacks)
    # NON aggiungere altri handler per /menu qui fuori

    def shutdown_handler(sig, frame):
        logger.info("🛑 Segnale %s — arresto", sig)
        _cleanup_downloads()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info("✅ Bot pronto — in ascolto")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()


