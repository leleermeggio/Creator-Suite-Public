"""Tests for backend.services.step_executor."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.step_executor import (
    TOOL_REGISTRY,
    _find_previous_output,
    build_step_context,
    dispatch_step,
)

# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------


def test_tool_registry_has_core_tools():
    """Verify all core tool IDs are registered."""
    core_tools = [
        "jumpcut",
        "transcribe",
        "translate",
        "summarize",
        "tts",
        "export",
        "thumbnail",
    ]
    for tool_id in core_tools:
        assert tool_id in TOOL_REGISTRY, f"Missing tool in registry: {tool_id}"


def test_tool_registry_has_audio_cleanup_tools():
    """Both spellings of audio cleanup should be registered."""
    assert "audio_cleanup" in TOOL_REGISTRY
    assert "audio-cleanup" in TOOL_REGISTRY


def test_tool_registry_has_captions_tools():
    """Both captions and caption should be registered."""
    assert "captions" in TOOL_REGISTRY
    assert "caption" in TOOL_REGISTRY


def test_tool_registry_has_noop_tools():
    """Noop tools should be registered."""
    noop_tools = [
        "download",
        "extract-audio",
        "normalize",
        "denoise",
        "reattach",
        "ai-highlights",
        "ai-clips",
        "cut",
        "export-text",
        "analyze-media",
    ]
    for tool_id in noop_tools:
        assert tool_id in TOOL_REGISTRY, f"Missing noop tool: {tool_id}"


# ---------------------------------------------------------------------------
# build_step_context tests
# ---------------------------------------------------------------------------


def test_build_step_context_with_media_path():
    """Context dict should have all required keys when media_path provided."""
    ctx = build_step_context(
        project_id="proj-123",
        user_id="user-456",
        media_path="/tmp/video.mp4",
        previous_outputs=[],
    )

    assert ctx["project_id"] == "proj-123"
    assert ctx["user_id"] == "user-456"
    assert ctx["media_path"] == "/tmp/video.mp4"
    assert ctx["previous_outputs"] == []


def test_build_step_context_defaults():
    """Context dict should work without media_path."""
    ctx = build_step_context(
        project_id="proj-999",
        user_id="user-001",
    )

    assert ctx["project_id"] == "proj-999"
    assert ctx["user_id"] == "user-001"
    assert ctx["media_path"] is None
    assert ctx["previous_outputs"] == []


def test_build_step_context_inherits_previous_output():
    """Previous outputs should be accessible in context."""
    previous = [
        {
            "tool_id": "transcribe",
            "output": {"transcript": "Hello world", "output_path": "/tmp/audio.wav"},
        },
        {"tool_id": "translate", "output": {"result": "Ciao mondo"}},
    ]

    ctx = build_step_context(
        project_id="proj-abc",
        user_id="user-xyz",
        previous_outputs=previous,
    )

    assert len(ctx["previous_outputs"]) == 2
    assert ctx["previous_outputs"][0]["tool_id"] == "transcribe"
    assert ctx["previous_outputs"][1]["tool_id"] == "translate"


# ---------------------------------------------------------------------------
# _find_previous_output tests
# ---------------------------------------------------------------------------


def test_find_previous_output_returns_value():
    """Should find a key from any previous output dict."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {
                "tool_id": "transcribe",
                "output": {"transcript": "hello", "output_path": "/tmp/a.wav"},
            },
        ],
    )

    result = _find_previous_output(ctx, "transcript")
    assert result == "hello"


def test_find_previous_output_returns_none_when_missing():
    """Should return None if key is not in any previous output."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "transcribe", "output": {"transcript": "hello"}},
        ],
    )

    result = _find_previous_output(ctx, "output_path")
    assert result is None


def test_find_previous_output_searches_all_steps():
    """Should search across multiple previous outputs."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "jumpcut", "output": {"output_path": "/tmp/cut.mp4"}},
            {"tool_id": "transcribe", "output": {"transcript": "test transcript"}},
        ],
    )

    assert _find_previous_output(ctx, "output_path") == "/tmp/cut.mp4"
    assert _find_previous_output(ctx, "transcript") == "test transcript"


# ---------------------------------------------------------------------------
# dispatch_step tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dispatch_step_unknown_tool_returns_error():
    """Unknown tool_id should return an error dict without raising."""
    ctx = build_step_context(project_id="p", user_id="u")
    result = await dispatch_step("nonexistent-tool-xyz", {}, ctx)
    assert "error" in result


@pytest.mark.asyncio
async def test_dispatch_step_noop_tool_returns_skipped():
    """Noop tools should return skipped status."""
    ctx = build_step_context(project_id="p", user_id="u")
    result = await dispatch_step("download", {}, ctx)
    assert result.get("status") == "skipped"


@pytest.mark.asyncio
async def test_dispatch_step_export_returns_output_path():
    """Export step should return output_path from previous outputs."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "jumpcut", "output": {"output_path": "/tmp/final.mp4"}},
        ],
    )
    result = await dispatch_step("export", {}, ctx)
    assert result.get("output_path") == "/tmp/final.mp4"


@pytest.mark.asyncio
async def test_dispatch_step_thumbnail_returns_placeholder():
    """Thumbnail step should return a placeholder dict."""
    ctx = build_step_context(project_id="p", user_id="u")
    result = await dispatch_step("thumbnail", {}, ctx)
    assert "status" in result


@pytest.mark.asyncio
async def test_dispatch_step_captions_returns_transcript():
    """Captions step should return transcript from previous outputs."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "transcribe", "output": {"transcript": "My transcript"}},
        ],
    )
    result = await dispatch_step("captions", {}, ctx)
    assert result.get("transcript") == "My transcript"


@pytest.mark.asyncio
async def test_dispatch_step_translate_calls_service():
    """Translate step should call translation_service.translate_text."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "transcribe", "output": {"transcript": "Hello world"}},
        ],
    )
    params = {"target_lang": "it"}

    with patch(
        "backend.services.step_executor.translation_service.translate_text",
        return_value="Ciao mondo",
    ):
        result = await dispatch_step("translate", params, ctx)

    assert result.get("result") == "Ciao mondo"


@pytest.mark.asyncio
async def test_dispatch_step_summarize_calls_service():
    """Summarize step should call gemini_service.summarize_text."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "transcribe", "output": {"transcript": "Long text here"}},
        ],
    )

    with patch(
        "backend.services.step_executor.gemini_service.summarize_text",
        return_value="Summary bullet points",
    ):
        result = await dispatch_step("summarize", {}, ctx)

    assert result.get("result") == "Summary bullet points"


@pytest.mark.asyncio
async def test_dispatch_step_tts_calls_service():
    """TTS step should call tts_service.text_to_speech."""
    ctx = build_step_context(
        project_id="p",
        user_id="u",
        previous_outputs=[
            {"tool_id": "translate", "output": {"result": "Ciao mondo"}},
        ],
    )
    params = {"language": "it"}

    with patch(
        "backend.services.step_executor.tts_service.text_to_speech",
        new_callable=AsyncMock,
        return_value="/tmp/speech.mp3",
    ):
        result = await dispatch_step("tts", params, ctx)

    assert result.get("output_path") == "/tmp/speech.mp3"


@pytest.mark.asyncio
async def test_dispatch_step_jumpcut_returns_error_on_no_media():
    """Jumpcut step with no media_path should return an error dict."""
    ctx = build_step_context(project_id="p", user_id="u", media_path=None)
    result = await dispatch_step("jumpcut", {}, ctx)
    assert "error" in result


@pytest.mark.asyncio
async def test_dispatch_step_jumpcut_calls_service():
    """Jumpcut step with media_path should call jumpcut_service."""
    from backend.services.jumpcut_service import JumpCutResult

    ctx = build_step_context(project_id="p", user_id="u", media_path="/tmp/input.mp4")

    mock_result = MagicMock(spec=JumpCutResult)
    mock_result.error = None
    mock_result.output_path = "/tmp/output.mp4"
    mock_result.original_duration = 60.0
    mock_result.final_duration = 45.0
    mock_result.segments_count = 10
    mock_result.removed_pct = 25.0

    with patch(
        "backend.services.step_executor.jumpcut_service.process_jumpcut",
        return_value=mock_result,
    ):
        result = await dispatch_step("jumpcut", {}, ctx)

    assert result.get("output_path") == "/tmp/output.mp4"
    assert "original_duration" in result
