from __future__ import annotations

import logging
import os

from backend.workers.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="ping")
def ping() -> str:
    return "pong"


@celery.task(name="process_job", bind=True)
def process_job(
    self, job_id: str, job_type: str, input_params: dict | None = None
) -> dict:
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
        return {
            "job_id": job_id,
            "job_type": job_type,
            "status": "failed",
            "error": str(e),
        }


def _handle_transcribe(job_id: str, params: dict) -> dict:
    from backend.services.transcriber_service import transcribe_audio

    file_path = params.get("file_path", "")
    language = params.get("language")
    model = params.get("model", os.getenv("WHISPER_MODEL", "small"))
    result = transcribe_audio(file_path, model_name=model, language=language)
    return {
        "job_id": job_id,
        "job_type": "transcribe",
        "status": "completed",
        "result": result,
    }


def _handle_jumpcut(job_id: str, params: dict) -> dict:
    from backend.services.jumpcut_service import (
        compute_keep_segments,
        detect_silence,
        get_duration,
        render_jumpcut,
    )

    file_path = params.get("file_path", "")
    threshold = params.get("silence_threshold", -30.0)
    min_duration = params.get("min_silence_duration", 0.5)

    silences = detect_silence(file_path, threshold, min_duration)
    total = get_duration(file_path)
    keeps = compute_keep_segments(silences, total)
    output = render_jumpcut(file_path, keeps)
    return {
        "job_id": job_id,
        "job_type": "jumpcut",
        "status": "completed",
        "result": {
            "output_path": output,
            "silences_removed": len(silences),
            "keeps": len(keeps),
        },
    }


def _handle_audio_cleanup(job_id: str, params: dict) -> dict:
    from backend.services.audio_cleanup_service import (
        normalize_audio,
        reduce_noise_ffmpeg,
    )

    file_path = params.get("file_path", "")
    denoised = reduce_noise_ffmpeg(file_path)
    normalized = normalize_audio(denoised)
    return {
        "job_id": job_id,
        "job_type": "audio_cleanup",
        "status": "completed",
        "result": {"output_path": normalized},
    }


def _handle_export(job_id: str, params: dict) -> dict:
    from backend.services.exporter_service import render_export

    file_path = params.get("file_path", "")
    preset = params.get("format_preset", "youtube_1080p")
    output = render_export(file_path, preset_name=preset)
    return {
        "job_id": job_id,
        "job_type": "export",
        "status": "completed",
        "result": {"output_path": output},
    }


def _handle_download(job_id: str, params: dict) -> dict:
    from backend.services.downloader_service import download_from_url

    url = params.get("url", "")
    result = download_from_url(url)
    return {
        "job_id": job_id,
        "job_type": "download",
        "status": "completed",
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
        "job_id": job_id,
        "job_type": "tts",
        "status": "completed",
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
            "job_id": job_id,
            "job_type": "translate",
            "status": "completed",
            "result": {"segments": translated, "target_language": target_lang},
        }
    text = params.get("text", "")
    translated_text = translate_text(text, target_lang, source_lang)
    return {
        "job_id": job_id,
        "job_type": "translate",
        "status": "completed",
        "result": {"text": translated_text, "target_language": target_lang},
    }


def _handle_convert(job_id: str, params: dict) -> dict:
    from backend.services.convert_service import convert_media

    file_path = params.get("file_path", "")
    target_format = params.get("target_format", "mp4")
    output = convert_media(file_path, target_format)
    return {
        "job_id": job_id,
        "job_type": "convert",
        "status": "completed",
        "result": {"output_path": output},
    }


def _handle_caption_burnin(job_id: str, params: dict) -> dict:
    from backend.services.caption_burnin_service import burn_captions

    file_path = params.get("file_path", "")
    segments = params.get("segments", [])
    style_preset = params.get("style_preset", "default")
    output = burn_captions(
        file_path,
        segments,
        style_preset=style_preset,
        font_family=params.get("font_family"),
        font_size=params.get("font_size"),
        color=params.get("color"),
        bg_color=params.get("bg_color"),
        position=params.get("position"),
    )
    return {
        "job_id": job_id,
        "job_type": "caption",
        "status": "completed",
        "result": {"output_path": output},
    }


def _handle_thumbnail_or_watermark(job_id: str, params: dict) -> dict:
    action = params.get("action", "")

    if action == "generate_thumbnail":
        from backend.config import get_settings
        from backend.services.thumbnail_service import generate_thumbnail
        from backend.storage.r2 import R2Client

        png_bytes = generate_thumbnail(
            template_id=params.get("template_id", "impact"),
            title=params.get("title", ""),
            subtitle=params.get("subtitle"),
            accent_color=params.get("accent_color", "#FF0000"),
            subject_photo_b64=params.get("subject_photo_b64"),
        )

        # Save: try R2, fall back to local tmp
        storage_key = f"thumbnails/{job_id}.png"
        download_url: str | None = None
        try:
            settings = get_settings()
            r2 = R2Client(
                endpoint_url=settings.R2_ENDPOINT_URL,
                access_key_id=settings.R2_ACCESS_KEY_ID,
                secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                bucket_name=settings.R2_BUCKET_NAME,
            )
            r2.upload_bytes(png_bytes, storage_key, content_type="image/png")
            download_url = r2.generate_download_url(storage_key, expires_in=86400)
        except Exception as e:
            logger.warning("R2 upload failed (%s) — saving locally", e)
            local_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "media", "thumbnails"
            )
            os.makedirs(local_dir, exist_ok=True)
            local_path = os.path.join(local_dir, f"{job_id}.png")
            with open(local_path, "wb") as f:
                f.write(png_bytes)
            storage_key = local_path
            download_url = None

        # Update thumbnail record
        import asyncio

        from sqlalchemy import update
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from backend.config import get_settings as gs
        from backend.models.thumbnail import Thumbnail

        async def _update_db() -> None:
            s = gs()
            engine = create_async_engine(s.DATABASE_URL)
            async_session = async_sessionmaker(engine, expire_on_commit=False)
            async with async_session() as session:
                await session.execute(
                    update(Thumbnail)
                    .where(Thumbnail.id == job_id)
                    .values(storage_key=storage_key)
                )
                await session.commit()
            await engine.dispose()

        asyncio.run(_update_db())
        return {
            "job_id": job_id,
            "job_type": "thumbnail",
            "status": "completed",
            "result": {"storage_key": storage_key, "download_url": download_url},
        }

    if action == "watermark_image":
        from backend.services.watermark_service import add_watermark

        file_path = params.get("file_path", "")
        watermark_path = params.get("watermark_path", "")
        output = add_watermark(
            file_path,
            watermark_path,
            position=params.get("position", "bottom_right"),
            opacity=params.get("opacity", 0.5),
            scale=params.get("scale", 0.15),
        )
        return {
            "job_id": job_id,
            "job_type": "thumbnail",
            "status": "completed",
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
            "job_id": job_id,
            "job_type": "thumbnail",
            "status": "completed",
            "result": {"output_path": output},
        }

    if action == "extract_frame":
        import subprocess
        import tempfile

        asset_id = params.get("asset_id", "")
        timestamp = float(params.get("timestamp", 0))

        # Locate asset file — try local storage path first, then R2 download
        local_path: str | None = None
        try:
            import asyncio

            from sqlalchemy import select
            from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

            from backend.config import get_settings
            from backend.models.media_asset import MediaAsset
            from backend.storage.r2 import R2Client

            async def _get_asset_key() -> str | None:
                s = get_settings()
                engine = create_async_engine(s.DATABASE_URL)
                async_session = async_sessionmaker(engine, expire_on_commit=False)
                async with async_session() as session:
                    filters = [MediaAsset.id == asset_id]
                    if user_id := params.get("user_id"):
                        filters.append(MediaAsset.user_id == user_id)
                    result = await session.execute(select(MediaAsset).where(*filters))
                    asset = result.scalar_one_or_none()
                    return asset.storage_key if asset else None

            storage_key = asyncio.run(_get_asset_key())
            if storage_key and os.path.isfile(storage_key):
                local_path = storage_key
            elif storage_key:
                s = get_settings()
                r2 = R2Client(
                    endpoint_url=s.R2_ENDPOINT_URL,
                    access_key_id=s.R2_ACCESS_KEY_ID,
                    secret_access_key=s.R2_SECRET_ACCESS_KEY,
                    bucket_name=s.R2_BUCKET_NAME,
                )
                tmp_fd, local_path = tempfile.mkstemp(suffix=".mp4")
                os.close(tmp_fd)
                r2.download_file(storage_key, local_path)
        except Exception as e:
            logger.warning("Could not retrieve asset for frame extraction: %s", e)
            return {
                "job_id": job_id,
                "job_type": "thumbnail",
                "status": "failed",
                "error": str(e),
            }

        if not local_path:
            return {
                "job_id": job_id,
                "job_type": "thumbnail",
                "status": "failed",
                "error": "asset not found",
            }

        out_fd, out_path = tempfile.mkstemp(suffix=".jpg")
        os.close(out_fd)
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-ss",
                    str(timestamp),
                    "-i",
                    local_path,
                    "-frames:v",
                    "1",
                    "-q:v",
                    "2",
                    "-y",
                    out_path,
                ],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error("FFmpeg frame extraction failed: %s", e.stderr)
            return {
                "job_id": job_id,
                "job_type": "thumbnail",
                "status": "failed",
                "error": "ffmpeg error",
            }

        with open(out_path, "rb") as f:
            frame_bytes = f.read()
        os.unlink(out_path)

        storage_key_out = f"thumbnails/frames/{job_id}.jpg"
        download_url: str | None = None
        try:
            from backend.config import get_settings
            from backend.storage.r2 import R2Client

            s = get_settings()
            r2 = R2Client(
                endpoint_url=s.R2_ENDPOINT_URL,
                access_key_id=s.R2_ACCESS_KEY_ID,
                secret_access_key=s.R2_SECRET_ACCESS_KEY,
                bucket_name=s.R2_BUCKET_NAME,
            )
            r2.upload_bytes(frame_bytes, storage_key_out, content_type="image/jpeg")
            download_url = r2.generate_download_url(storage_key_out, expires_in=86400)
        except Exception as e:
            logger.warning("R2 upload of frame failed (%s) — saving locally", e)
            local_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "media", "frames"
            )
            os.makedirs(local_dir, exist_ok=True)
            storage_key_out = os.path.join(local_dir, f"{job_id}.jpg")
            with open(storage_key_out, "wb") as f:
                f.write(frame_bytes)

        import asyncio as _asyncio

        from sqlalchemy import update as _update
        from sqlalchemy.ext.asyncio import async_sessionmaker as _asm
        from sqlalchemy.ext.asyncio import create_async_engine as _cae

        from backend.config import get_settings as _gs
        from backend.models.thumbnail import Thumbnail as _Thumb

        async def _update_thumb() -> None:
            s = _gs()
            engine = _cae(s.DATABASE_URL)
            session_factory = _asm(engine, expire_on_commit=False)
            async with session_factory() as session:
                await session.execute(
                    _update(_Thumb)
                    .where(_Thumb.id == job_id)
                    .values(storage_key=storage_key_out)
                )
                await session.commit()
            await engine.dispose()

        _asyncio.run(_update_thumb())
        return {
            "job_id": job_id,
            "job_type": "thumbnail",
            "status": "completed",
            "result": {"storage_key": storage_key_out, "download_url": download_url},
        }

    # Default: thumbnail extraction stub
    return {"job_id": job_id, "job_type": "thumbnail", "status": "completed"}
