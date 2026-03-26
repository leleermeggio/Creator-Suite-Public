from __future__ import annotations

import logging
import os
import tempfile

from backend.workers.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="ping")
def ping() -> str:
    return "pong"


@celery.task(name="process_job", bind=True)
def process_job(self, job_id: str, job_type: str, input_params: dict | None = None) -> dict:
    """Process an AI/media job by dispatching to the appropriate service."""
    logger.info("Processing job %s (type=%s)", job_id, job_type)
    params = input_params or {}

    try:
        if job_type == "transcribe":
            return _handle_transcribe(job_id, params)
        elif job_type == "jumpcut":
            return _handle_jumpcut(job_id, params)
        elif job_type == "audio_cleanup":
            return _handle_audio_cleanup(job_id, params)
        elif job_type == "export":
            return _handle_export(job_id, params)
        elif job_type == "download":
            return _handle_download(job_id, params)
        elif job_type == "tts":
            return _handle_tts(job_id, params)
        elif job_type == "translate":
            return _handle_translate(job_id, params)
        elif job_type == "convert":
            return _handle_convert(job_id, params)
        elif job_type == "caption":
            return _handle_caption_burnin(job_id, params)
        elif job_type == "thumbnail":
            return _handle_thumbnail_or_watermark(job_id, params)
        else:
            return {"job_id": job_id, "job_type": job_type, "status": "completed"}
    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        return {"job_id": job_id, "job_type": job_type, "status": "failed", "error": str(e)}


def _handle_transcribe(job_id: str, params: dict) -> dict:
    from backend.services.transcriber_service import transcribe_audio
    file_path = params.get("file_path", "")
    language = params.get("language")
    model = params.get("model", os.getenv("WHISPER_MODEL", "small"))
    result = transcribe_audio(file_path, model_name=model, language=language)
    return {"job_id": job_id, "job_type": "transcribe", "status": "completed", "result": result}


def _handle_jumpcut(job_id: str, params: dict) -> dict:
    from backend.services.jumpcut_service import (
        compute_keep_segments, detect_silence, get_duration, render_jumpcut,
    )
    file_path = params.get("file_path", "")
    threshold = params.get("silence_threshold", -30.0)
    min_duration = params.get("min_silence_duration", 0.5)

    silences = detect_silence(file_path, threshold, min_duration)
    total = get_duration(file_path)
    keeps = compute_keep_segments(silences, total)
    output = render_jumpcut(file_path, keeps)
    return {
        "job_id": job_id, "job_type": "jumpcut", "status": "completed",
        "result": {"output_path": output, "silences_removed": len(silences), "keeps": len(keeps)},
    }


def _handle_audio_cleanup(job_id: str, params: dict) -> dict:
    from backend.services.audio_cleanup_service import normalize_audio, reduce_noise_ffmpeg
    file_path = params.get("file_path", "")
    denoised = reduce_noise_ffmpeg(file_path)
    normalized = normalize_audio(denoised)
    return {
        "job_id": job_id, "job_type": "audio_cleanup", "status": "completed",
        "result": {"output_path": normalized},
    }


def _handle_export(job_id: str, params: dict) -> dict:
    from backend.services.exporter_service import render_export
    file_path = params.get("file_path", "")
    preset = params.get("format_preset", "youtube_1080p")
    output = render_export(file_path, preset_name=preset)
    return {
        "job_id": job_id, "job_type": "export", "status": "completed",
        "result": {"output_path": output},
    }


def _handle_download(job_id: str, params: dict) -> dict:
    from backend.services.downloader_service import download_from_url
    url = params.get("url", "")
    result = download_from_url(url)
    return {
        "job_id": job_id, "job_type": "download", "status": "completed",
        "result": result,
    }


def _handle_tts(job_id: str, params: dict) -> dict:
    import asyncio
    from backend.services.tts_service import text_to_speech
    text = params.get("text", "")
    language = params.get("language", "it")
    output_path = asyncio.get_event_loop().run_until_complete(
        text_to_speech(text, language=language)
    )
    return {
        "job_id": job_id, "job_type": "tts", "status": "completed",
        "result": {"output_path": output_path},
    }


def _handle_translate(job_id: str, params: dict) -> dict:
    from backend.services.translation_service import translate_segments, translate_text
    segments = params.get("segments")
    target_lang = params.get("target_language", "en")
    source_lang = params.get("source_language", "auto")

    if segments:
        translated = translate_segments(segments, target_lang, source_lang)
        return {
            "job_id": job_id, "job_type": "translate", "status": "completed",
            "result": {"segments": translated, "target_language": target_lang},
        }
    text = params.get("text", "")
    translated_text = translate_text(text, target_lang, source_lang)
    return {
        "job_id": job_id, "job_type": "translate", "status": "completed",
        "result": {"text": translated_text, "target_language": target_lang},
    }


def _handle_convert(job_id: str, params: dict) -> dict:
    from backend.services.convert_service import convert_media
    file_path = params.get("file_path", "")
    target_format = params.get("target_format", "mp4")
    output = convert_media(file_path, target_format)
    return {
        "job_id": job_id, "job_type": "convert", "status": "completed",
        "result": {"output_path": output},
    }


def _handle_caption_burnin(job_id: str, params: dict) -> dict:
    from backend.services.caption_burnin_service import burn_captions
    file_path = params.get("file_path", "")
    segments = params.get("segments", [])
    style_preset = params.get("style_preset", "default")
    output = burn_captions(
        file_path, segments, style_preset=style_preset,
        font_family=params.get("font_family"),
        font_size=params.get("font_size"),
        color=params.get("color"),
        bg_color=params.get("bg_color"),
        position=params.get("position"),
    )
    return {
        "job_id": job_id, "job_type": "caption", "status": "completed",
        "result": {"output_path": output},
    }


def _handle_thumbnail_or_watermark(job_id: str, params: dict) -> dict:
    action = params.get("action", "")

    if action == "watermark_image":
        from backend.services.watermark_service import add_watermark
        file_path = params.get("file_path", "")
        watermark_path = params.get("watermark_path", "")
        output = add_watermark(
            file_path, watermark_path,
            position=params.get("position", "bottom_right"),
            opacity=params.get("opacity", 0.5),
            scale=params.get("scale", 0.15),
        )
        return {
            "job_id": job_id, "job_type": "thumbnail", "status": "completed",
            "result": {"output_path": output},
        }

    elif action == "watermark_text":
        from backend.services.watermark_service import add_text_watermark
        file_path = params.get("file_path", "")
        output = add_text_watermark(
            file_path,
            text=params.get("text", ""),
            position=params.get("position", "bottom_right"),
            font_size=params.get("font_size", 24),
            color=params.get("color", "white"),
            opacity=params.get("opacity", 0.5),
        )
        return {
            "job_id": job_id, "job_type": "thumbnail", "status": "completed",
            "result": {"output_path": output},
        }

    # Default: thumbnail extraction stub
    return {"job_id": job_id, "job_type": "thumbnail", "status": "completed"}
