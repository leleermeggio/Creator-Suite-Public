"""Creator Suite Bot — Inline keyboards."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from bot.translator import LANGUAGES

# ---------------------------------------------------------------------------
# Main Menu
# ---------------------------------------------------------------------------
MENU_TEXT = (
    "━━━━━━━━━━━━━━━━━━━━\n"
    "  🤖  <b>Creator Suite Bot</b>\n"
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

# ---------------------------------------------------------------------------
# Language Keyboard
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Convert Keyboard
# ---------------------------------------------------------------------------
def _convert_keyboard() -> InlineKeyboardMarkup:
    from bot.services import AUDIO_FMTS, VIDEO_FMTS
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
