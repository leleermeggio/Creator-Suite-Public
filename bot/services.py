"""Servizi aggiuntivi — Gemini AI, TTS, conversione formato."""

from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path

import edge_tts
import PIL.Image

try:
    import google.generativeai as genai
except ImportError:
    genai = None

logger = logging.getLogger("bot.services")

AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")
DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR", "/app/downloads")

# ═══════════════════════════════════════════════════════════════════
# 🤖 Gemini AI (riassunto + OCR)
# ═══════════════════════════════════════════════════════════════════
_gemini_model = None


def _get_gemini():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        if genai is None:
            return None
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
        logger.info("✅ Gemini AI inizializzato")
        return _gemini_model
    except Exception as e:
        logger.error("❌ Gemini init fallito: %s", e)
        return None


def gemini_available() -> bool:
    return bool(os.getenv("GOOGLE_API_KEY"))


def summarize_text(text: str) -> str | None:
    model = _get_gemini()
    if not model:
        return None
    try:
        response = model.generate_content(
            "Riassumi il seguente testo in modo chiaro e conciso. "
            "Usa elenchi puntati dove appropriato. "
            "Rispondi nella stessa lingua del testo originale.\n\n" + text
        )
        return response.text
    except Exception as e:
        logger.error("❌ [Riassunto] Errore Gemini: %s", e)
        return None


def ocr_image(image_path: str) -> str | None:
    model = _get_gemini()
    if not model:
        return None
    try:
        img = PIL.Image.open(image_path)
        response = model.generate_content([
            "Estrai tutto il testo visibile in questa immagine. "
            "Restituisci SOLO il testo estratto, senza commenti o spiegazioni.",
            img,
        ])
        return response.text
    except Exception as e:
        logger.error("❌ [OCR] Errore Gemini: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════
# 🗣️ Text-to-Speech (edge-tts)
# ═══════════════════════════════════════════════════════════════════
TTS_VOICES = {
    "it": "it-IT-IsabellaNeural",
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "ar": "ar-SA-ZariyahNeural",
}


async def text_to_speech(text: str, lang: str = "it") -> str | None:
    try:
        voice = TTS_VOICES.get(lang, TTS_VOICES["it"])
        output_path = os.path.join(AUDIO_DIR, f"tts_{abs(hash(text)):08x}.mp3")
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        logger.info("🗣️ TTS completato → %s (%s)", voice, Path(output_path).name)
        return output_path
    except Exception as e:
        logger.error("❌ [TTS] Errore: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════
# 🔄 Conversione formato (ffmpeg)
# ═══════════════════════════════════════════════════════════════════
CONVERT_FORMATS = {
    "mp3":  ["-vn", "-codec:a", "libmp3lame", "-q:a", "2"],
    "wav":  ["-vn", "-codec:a", "pcm_s16le"],
    "ogg":  ["-vn", "-codec:a", "libvorbis", "-q:a", "5"],
    "flac": ["-vn", "-codec:a", "flac"],
    "aac":  ["-vn", "-codec:a", "aac", "-b:a", "192k"],
    "m4a":  ["-vn", "-codec:a", "aac", "-b:a", "192k"],
    "mp4":  ["-codec:v", "libx264", "-preset", "fast", "-codec:a", "aac"],
    "mkv":  ["-codec:v", "copy", "-codec:a", "copy"],
    "webm": ["-codec:v", "libvpx-vp9", "-codec:a", "libopus"],
}

AUDIO_FMTS = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
VIDEO_FMTS = {"mp4", "mkv", "webm"}


def convert_media(input_path: str, target_format: str) -> str | None:
    target_format = target_format.lower().strip(".")
    if target_format not in CONVERT_FORMATS:
        logger.error("❌ Formato non supportato: %s", target_format)
        return None

    input_p = Path(input_path)
    output_path = os.path.join(
        DOWNLOADS_DIR, f"{input_p.stem}_converted.{target_format}"
    )
    args = CONVERT_FORMATS[target_format]
    cmd = ["ffmpeg", "-y", "-i", str(input_path)] + args + [output_path]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error("❌ ffmpeg: %s", result.stderr[-500:])
            return None
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return None
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info("✅ Convertito: %s → .%s (%.1f MB)", input_p.name, target_format, size_mb)
        return output_path
    except subprocess.TimeoutExpired:
        logger.error("❌ ffmpeg timeout (5 min)")
        return None
    except FileNotFoundError:
        logger.error("❌ ffmpeg non trovato nel sistema")
        return None
