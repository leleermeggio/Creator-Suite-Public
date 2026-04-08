"""Creator Suite Bot — Main entry point."""

from __future__ import annotations

import logging
import signal
import sys

from telegram import BotCommand
from telegram.ext import Application, CommandHandler, ConversationHandler, CallbackQueryHandler, MessageHandler, filters
from bot.handlers.base import start_cmd, back_to_menu
from bot.handlers.transcribe import transcribe_selected, process_transcribe
from bot.handlers.translate import translate_selected, translate_lang_selected, process_translate
from bot.handlers.images import images_selected, process_images
from bot.handlers.mp3 import mp3_selected, process_mp3
from bot.handlers.video import video_selected, process_video
from bot.handlers.summarize import summarize_selected, process_summarize
from bot.handlers.ocr import ocr_selected, process_ocr
from bot.handlers.info import info_selected, process_info
from bot.handlers.tts import tts_selected, process_tts
from bot.handlers.convert import convert_selected, convert_fmt_selected, process_convert
from bot.handlers.jumpcut import jumpcut_selected, process_jumpcut_video, jumpcut_help_cmd
from bot.handlers.generate_image import generate_image_selected, process_generate_image, unset_api_key_cmd
from bot.config import (
    CHOOSING, TRANSCRIBE_WAIT, TRANSLATE_LANG, TRANSLATE_WAIT,
    IMAGES_WAIT, MP3_WAIT, VIDEO_WAIT, SUMMARIZE_WAIT,
    OCR_WAIT, INFO_WAIT, TTS_WAIT, CONVERT_FMT, CONVERT_WAIT, JUMPCUT_WAIT,
    GENERATE_IMAGE_WAIT, ensure_directories, TELEGRAM_TOKEN,
)

logger = logging.getLogger("bot")


async def post_init(app: Application) -> None:
    """Initialize bot commands."""
    await app.bot.set_my_commands([
        BotCommand("start", "Creator Suite"),
    ])
    logger.info("📝 Comando registrato: /start - Creator Suite")


def main():
    """Main entry point."""
    # Ensure directories exist
    ensure_directories()

    # Setup logging
    from pathlib import Path
    from bot.config import LOG_DIR
    log_file = Path(LOG_DIR) / "bot.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file),
        ],
    )
    for noisy in ("httpx", "httpcore", "telegram.ext", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logger.info("🚀 Avvio Creator Suite Bot…")

    # Check ffmpeg
    from bot.jumpcut import check_ffmpeg
    if check_ffmpeg():
        logger.info("✅ ffmpeg trovato")
    else:
        logger.warning("⚠️ ffmpeg NON trovato — Jump Cut e Converti non funzioneranno")

    logger.info("👥 Supporto gruppi attivo — disabilita Privacy Mode via @BotFather per uso completo nei gruppi")

    # Build application
    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    # Conversation handler
    conv = ConversationHandler(
        per_message=False,
        entry_points=[
            CommandHandler("start", start_cmd),
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
                CallbackQueryHandler(generate_image_selected, pattern="^generate_image$"),
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
            GENERATE_IMAGE_WAIT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_generate_image),
                CallbackQueryHandler(back_to_menu, pattern="^back$"),
            ],
        },
        fallbacks=[
            CommandHandler("start", start_cmd),
        ],
    )

    app.add_handler(conv)
    app.add_handler(CommandHandler("jumpcut_help", jumpcut_help_cmd))
    app.add_handler(CommandHandler("unset_api", unset_api_key_cmd))

    def shutdown_handler(sig, frame):
        logger.info("🛑 Segnale %s — arresto", sig)
        from bot.utils import _cleanup_downloads
        _cleanup_downloads()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info("✅ Bot pronto — in ascolto")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
