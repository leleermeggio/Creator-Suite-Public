"""Step executor service — dispatches mission step tool_id strings to real service calls.

Each tool handler is an async function receiving (parameters, context) and returning
an output dict. Sync service functions are wrapped via asyncio.to_thread().
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

DEFAULT_TOOL_TIMEOUT = 300  # 5 minutes default timeout

from backend.services import (
    audio_cleanup_service,
    gemini_service,
    jumpcut_service,
    media_analysis_service,
    translation_service,
    tts_service,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

Context = dict[str, Any]
Parameters = dict[str, Any]


# ---------------------------------------------------------------------------
# Context construction
# ---------------------------------------------------------------------------


def build_step_context(
    project_id: str,
    user_id: str,
    media_path: str | None = None,
    previous_outputs: list[dict[str, Any]] | None = None,
) -> Context:
    """Construct a context dict for step execution.

    Args:
        project_id: The project this step belongs to.
        user_id: The owning user's ID.
        media_path: Optional path to the primary media file.
        previous_outputs: List of dicts from earlier steps.
            Each entry: {"tool_id": str, "output": dict}

    Returns:
        Context dict with keys: project_id, user_id, media_path, previous_outputs.
    """
    return {
        "project_id": project_id,
        "user_id": user_id,
        "media_path": media_path,
        "previous_outputs": previous_outputs if previous_outputs is not None else [],
    }


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _find_previous_output(ctx: Context, key: str) -> Any | None:
    """Search previous step outputs for a specific key.

    Iterates over previous_outputs in order and returns the first match.

    Args:
        ctx: Step execution context.
        key: Key to search for within each output dict.

    Returns:
        First value found for the key, or None.
    """
    for step in ctx.get("previous_outputs", []):
        output = step.get("output", {})
        if key in output:
            return output[key]
    return None


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


async def _handle_jumpcut(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Run jump-cut silence removal on the media file."""
    media_path = ctx.get("media_path") or _find_previous_output(ctx, "output_path")
    if not media_path:
        return {
            "error": "jumpcut requires media_path in context or a previous output_path"
        }

    noise_db: float = float(params.get("noise_db", jumpcut_service.SILENCE_THRESH_DB))
    min_silence: float = float(
        params.get("min_silence", jumpcut_service.MIN_SILENCE_SEC)
    )
    padding: float = float(params.get("padding", jumpcut_service.PADDING_SEC))
    crossfade: float = float(params.get("crossfade", jumpcut_service.CROSSFADE_SEC))
    output_dir: str | None = params.get("output_dir")

    logger.info("🚀 Dispatching jumpcut on %s", media_path)

    try:
        result = await asyncio.to_thread(
            jumpcut_service.process_jumpcut,
            media_path,
            output_dir,
            noise_db,
            min_silence,
            padding,
            crossfade,
        )
    except Exception as exc:
        logger.error("❌ jumpcut failed: %s", exc)
        return {"error": str(exc)}

    if result.error:
        logger.error("❌ jumpcut returned error: %s", result.error)
        return {"error": result.error}

    logger.info("✅ jumpcut completed: %s", result.output_path)
    return {
        "output_path": result.output_path,
        "original_duration": result.original_duration,
        "final_duration": result.final_duration,
        "segments_count": result.segments_count,
        "removed_pct": result.removed_pct,
    }


async def _handle_transcribe(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Transcribe media audio using Whisper."""
    media_path = ctx.get("media_path") or _find_previous_output(ctx, "output_path")
    if not media_path:
        return {
            "error": "transcribe requires media_path in context or a previous output_path"
        }

    try:
        from backend.services import transcriber_service
    except ImportError as exc:
        logger.error("❌ transcriber_service not available: %s", exc)
        return {"error": f"transcriber_service not available: {exc}"}

    model_name: str = params.get("model", "small")
    language: str | None = params.get("language")

    logger.info("🚀 Dispatching transcribe on %s", media_path)

    try:
        result = await asyncio.to_thread(
            transcriber_service.transcribe_audio,
            media_path,
            model_name,
            language,
        )
    except Exception as exc:
        logger.error("❌ transcribe failed: %s", exc)
        return {"error": str(exc)}

    transcript_text: str = result.get("text", "")
    logger.info("✅ transcribe completed (%d chars)", len(transcript_text))
    return {
        "transcript": transcript_text,
        "segments": result.get("segments", []),
    }


async def _handle_translate(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Translate text using translation_service."""
    text: str | None = (
        params.get("text")
        or _find_previous_output(ctx, "transcript")
        or _find_previous_output(ctx, "result")
    )
    if not text:
        return {
            "error": "translate requires text parameter or previous transcript/result"
        }

    target_lang: str = params.get("target_lang", params.get("target_language", "en"))
    source_lang: str = params.get("source_lang", "auto")

    logger.info("🚀 Dispatching translate → %s", target_lang)

    try:
        result = await asyncio.to_thread(
            translation_service.translate_text,
            text,
            target_lang,
            source_lang,
        )
    except Exception as exc:
        logger.error("❌ translate failed: %s", exc)
        return {"error": str(exc)}

    logger.info("✅ translate completed")
    return {"result": result}


async def _handle_summarize(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Summarize text using Gemini."""
    text: str | None = (
        params.get("text")
        or _find_previous_output(ctx, "transcript")
        or _find_previous_output(ctx, "result")
    )
    if not text:
        return {
            "error": "summarize requires text parameter or previous transcript/result"
        }

    language: str | None = params.get("language")

    logger.info("🚀 Dispatching summarize")

    try:
        result = await asyncio.to_thread(
            gemini_service.summarize_text,
            text,
            language,
        )
    except Exception as exc:
        logger.error("❌ summarize failed: %s", exc)
        return {"error": str(exc)}

    if result is None:
        return {"error": "summarize returned no result (check GOOGLE_API_KEY)"}

    logger.info("✅ summarize completed")
    return {"result": result}


async def _handle_tts(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Convert text to speech using tts_service."""
    text: str | None = (
        params.get("text")
        or _find_previous_output(ctx, "result")
        or _find_previous_output(ctx, "transcript")
    )
    if not text:
        return {"error": "tts requires text parameter or previous result/transcript"}

    language: str = params.get("language", "it")
    output_path: str | None = params.get("output_path")

    logger.info("🚀 Dispatching tts (lang=%s)", language)

    try:
        result_path = await tts_service.text_to_speech(
            text,
            language=language,
            output_path=output_path,
        )
    except Exception as exc:
        logger.error("❌ tts failed: %s", exc)
        return {"error": str(exc)}

    logger.info("✅ tts completed: %s", result_path)
    return {"output_path": result_path}


async def _handle_thumbnail(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Return placeholder — thumbnail generation is handled separately."""
    logger.info("🚀 Dispatching thumbnail (placeholder)")
    return {
        "status": "pending",
        "message": "Thumbnail generation is handled by the thumbnail service endpoint",
        "media_path": ctx.get("media_path"),
    }


async def _handle_export(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Return the output_path from previous steps as the export result."""
    output_path = _find_previous_output(ctx, "output_path") or ctx.get("media_path")
    logger.info("✅ export step resolved output_path: %s", output_path)
    return {"output_path": output_path, "status": "ready"}


async def _handle_analyze_media(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Analyze media file metadata and insights."""
    media_path = ctx.get("media_path") or _find_previous_output(ctx, "output_path")
    if not media_path:
        return {
            "error": "analyze-media requires media_path in context or a previous output_path"
        }

    transcript_text: str | None = params.get("transcript") or _find_previous_output(
        ctx, "transcript"
    )

    logger.info("🚀 Dispatching analyze-media on %s", media_path)

    try:
        result = await asyncio.to_thread(
            media_analysis_service.analyze_media,
            media_path,
            transcript_text,
        )
    except Exception as exc:
        logger.error("❌ analyze-media failed: %s", exc)
        return {"error": str(exc)}

    logger.info("✅ analyze-media completed")
    return result


async def _handle_audio_cleanup(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Normalize and denoise audio using audio_cleanup_service."""
    media_path = ctx.get("media_path") or _find_previous_output(ctx, "output_path")
    if not media_path:
        return {
            "error": "audio-cleanup requires media_path in context or a previous output_path"
        }

    target_lufs: float = float(params.get("target_lufs", -14.0))
    noise_floor: float = float(params.get("noise_floor", -25.0))

    logger.info("🚀 Dispatching audio-cleanup on %s", media_path)

    try:
        normalized_path = await asyncio.to_thread(
            audio_cleanup_service.normalize_audio,
            media_path,
            target_lufs,
        )
        denoised_path = await asyncio.to_thread(
            audio_cleanup_service.reduce_noise_ffmpeg,
            normalized_path,
            noise_floor,
        )
    except Exception as exc:
        logger.error("❌ audio-cleanup failed: %s", exc)
        return {"error": str(exc)}

    logger.info("✅ audio-cleanup completed: %s", denoised_path)
    return {"output_path": denoised_path, "normalized_path": normalized_path}


async def _handle_captions(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Return transcript from previous outputs for caption rendering."""
    transcript = _find_previous_output(ctx, "transcript") or params.get("transcript")
    segments = _find_previous_output(ctx, "segments") or []
    logger.info(
        "✅ captions step resolved transcript (%d chars)", len(transcript or "")
    )
    return {"transcript": transcript, "segments": segments}


async def _handle_noop(params: Parameters, ctx: Context) -> dict[str, Any]:
    """Placeholder for tools not yet implemented for inline execution."""
    return {
        "status": "skipped",
        "message": "Tool not yet implemented for inline execution",
    }


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, Any] = {
    "jumpcut": _handle_jumpcut,
    "transcribe": _handle_transcribe,
    "translate": _handle_translate,
    "summarize": _handle_summarize,
    "tts": _handle_tts,
    "thumbnail": _handle_thumbnail,
    "export": _handle_export,
    "analyze-media": _handle_analyze_media,
    "audio_cleanup": _handle_audio_cleanup,
    "audio-cleanup": _handle_audio_cleanup,
    "captions": _handle_captions,
    "caption": _handle_captions,
    # ── Noop tools ──────────────────────────────────────────────────────────
    "download": _handle_noop,
    "extract-audio": _handle_noop,
    "normalize": _handle_noop,
    "denoise": _handle_noop,
    "reattach": _handle_noop,
    "ai-highlights": _handle_noop,
    "ai-clips": _handle_noop,
    "cut": _handle_noop,
    "export-text": _handle_noop,
}


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------


async def dispatch_step(
    tool_id: str,
    parameters: Parameters,
    context: Context,
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    """Look up the handler for tool_id and invoke it.

    Args:
        tool_id: The tool identifier string (e.g. "jumpcut", "transcribe").
        parameters: Tool-specific parameters from the mission step.
        context: Execution context built by build_step_context().
        timeout_seconds: Optional timeout override for this step.

    Returns:
        Output dict from the handler. Always returns a dict — never raises.
        Returns {"error": "..."} on unknown tool or handler failure.
    """
    handler = TOOL_REGISTRY.get(tool_id)
    if handler is None:
        logger.error("❌ Unknown tool_id: %s", tool_id)
        return {"error": f"Unknown tool: {tool_id}"}

    timeout = timeout_seconds or parameters.get("timeout", DEFAULT_TOOL_TIMEOUT)

    logger.info(
        "🚀 Dispatching step tool_id=%s project=%s (timeout=%ds)",
        tool_id, context.get("project_id"), timeout
    )

    try:
        result = await asyncio.wait_for(
            handler(parameters, context), timeout=timeout
        )
    except asyncio.TimeoutError:
        logger.error("❌ Step %s timed out after %ds", tool_id, timeout)
        return {"error": f"Step timed out after {timeout} seconds"}
    except Exception as exc:
        logger.error("❌ Step handler %s raised unexpectedly: %s", tool_id, exc)
        return {"error": str(exc)}

    logger.info("✅ Completed step tool_id=%s", tool_id)
    return result
