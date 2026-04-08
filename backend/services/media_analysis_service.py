from __future__ import annotations

import json
import logging
import subprocess
import uuid
from typing import Any

logger = logging.getLogger(__name__)


# ── FFmpeg probe ───────────────────────────────────────────────────────────────


def probe_media(file_path: str) -> dict[str, Any]:
    """Run ffprobe + ffmpeg loudnorm/silencedetect on a file.

    Returns a metadata dict with keys:
      duration, bitrate, width, height, fps, audio_channels, audio_sample_rate,
      loudness_lufs, silence_percent, has_video, has_audio
    """
    result: dict[str, Any] = {
        "duration": None,
        "bitrate": None,
        "width": None,
        "height": None,
        "fps": None,
        "audio_channels": None,
        "audio_sample_rate": None,
        "loudness_lufs": None,
        "silence_percent": None,
        "has_video": False,
        "has_audio": False,
    }

    # --- Basic stream info ---
    try:
        probe_cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
        ]
        probe_out = subprocess.run(
            probe_cmd, capture_output=True, text=True, timeout=30
        )
        if probe_out.returncode != 0:
            logger.warning("ffprobe non-zero exit: %s", probe_out.stderr[:200])
            return result

        probe_data = json.loads(probe_out.stdout)
        fmt = probe_data.get("format", {})
        streams = probe_data.get("streams", [])

        result["duration"] = float(fmt.get("duration") or 0)
        result["bitrate"] = int(fmt.get("bit_rate") or 0)

        for stream in streams:
            codec_type = stream.get("codec_type", "")
            if codec_type == "video" and not result["has_video"]:
                result["has_video"] = True
                result["width"] = stream.get("width")
                result["height"] = stream.get("height")
                fps_str = stream.get("r_frame_rate", "0/1")
                try:
                    num, den = fps_str.split("/")
                    result["fps"] = round(int(num) / int(den), 2) if int(den) else None
                except (ValueError, ZeroDivisionError):
                    pass
            elif codec_type == "audio" and not result["has_audio"]:
                result["has_audio"] = True
                result["audio_channels"] = stream.get("channels")
                result["audio_sample_rate"] = int(stream.get("sample_rate") or 0)

    except FileNotFoundError:
        logger.warning("ffprobe not found — skipping media probe")
        return result
    except Exception as exc:
        logger.error("Media probe failed: %s", exc)
        return result

    # --- Loudness (EBU R128) ---
    try:
        loudnorm_cmd = [
            "ffmpeg",
            "-i",
            file_path,
            "-af",
            "loudnorm=print_format=json",
            "-f",
            "null",
            "-",
        ]
        loudnorm_out = subprocess.run(
            loudnorm_cmd, capture_output=True, text=True, timeout=60
        )
        stderr = loudnorm_out.stderr
        start = stderr.rfind("{")
        end = stderr.rfind("}") + 1
        if start != -1 and end > start:
            loudnorm_data = json.loads(stderr[start:end])
            result["loudness_lufs"] = float(loudnorm_data.get("input_i") or 0)
    except Exception as exc:
        logger.debug("Loudnorm analysis skipped: %s", exc)

    # --- Silence detection ---
    try:
        silence_cmd = [
            "ffmpeg",
            "-i",
            file_path,
            "-af",
            "silencedetect=noise=-35dB:d=0.4",
            "-f",
            "null",
            "-",
        ]
        silence_out = subprocess.run(
            silence_cmd, capture_output=True, text=True, timeout=60
        )
        duration = result.get("duration") or 0.0
        silence_starts: list[float] = []
        silence_ends: list[float] = []

        for line in silence_out.stderr.split("\n"):
            if "silence_start" in line:
                try:
                    silence_starts.append(
                        float(line.split("silence_start:")[1].strip())
                    )
                except (IndexError, ValueError):
                    pass
            elif "silence_end" in line:
                try:
                    silence_ends.append(
                        float(line.split("silence_end:")[1].split("|")[0].strip())
                    )
                except (IndexError, ValueError):
                    pass

        silence_total = sum(
            max(0.0, e - s) for s, e in zip(silence_starts, silence_ends)
        )
        result["silence_percent"] = (
            round((silence_total / duration) * 100, 1) if duration > 0 else 0.0
        )
    except Exception as exc:
        logger.debug("Silence detection skipped: %s", exc)

    return result


# ── Rule-based insights (no AI required) ──────────────────────────────────────


def generate_rule_based_insights(media_meta: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate InsightCard dicts from media metadata heuristics alone."""
    insights: list[dict[str, Any]] = []

    silence_pct = media_meta.get("silence_percent")
    if silence_pct is not None and silence_pct >= 30:
        insights.append(
            {
                "id": str(uuid.uuid4()),
                "type": "quality",
                "message": f"{silence_pct:.0f}% silenzio rilevato — Jumpcut consigliato",
                "action_tool": "jumpcut",
                "action_params": {"silence_threshold": -35.0, "min_silence": 0.4},
                "status": "PENDING",
                "confidence": 0.9,
            }
        )

    loudness = media_meta.get("loudness_lufs")
    if loudness is not None and loudness < -23:
        insights.append(
            {
                "id": str(uuid.uuid4()),
                "type": "quality",
                "message": f"Audio basso ({loudness:.1f} LUFS) — normalizzazione consigliata",
                "action_tool": "audio_cleanup",
                "action_params": {"normalize": True, "target_loudness": -14},
                "status": "PENDING",
                "confidence": 0.85,
            }
        )

    duration = media_meta.get("duration")
    if duration and duration > 180:
        insights.append(
            {
                "id": str(uuid.uuid4()),
                "type": "opportunity",
                "message": f"Video lungo ({duration / 60:.1f} min) — considera clip per Shorts/Reels",
                "action_tool": "analyze_media",
                "action_params": {"suggest_clips": True},
                "status": "PENDING",
                "confidence": 0.75,
            }
        )

    return insights


# ── Gemini transcript analysis ─────────────────────────────────────────────────


def analyze_transcript_with_gemini(
    transcript_text: str,
    media_meta: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Use Gemini to extract InsightCard dicts from a transcript + audio metadata.

    Returns an empty list if Gemini is unavailable or returns an invalid response.
    """
    from backend.services.gemini_service import _get_model

    model = _get_model()
    if not model:
        logger.info("Gemini unavailable — skipping AI transcript analysis")
        return []

    meta_section = ""
    if media_meta:
        meta_section = (
            f"\nAudio/Video metadata:\n"
            f"- Duration: {media_meta.get('duration', 'unknown')}s\n"
            f"- Silence: {media_meta.get('silence_percent', 'unknown')}%\n"
            f"- Loudness: {media_meta.get('loudness_lufs', 'unknown')} LUFS\n"
            f"- Resolution: {media_meta.get('width', '?')}x{media_meta.get('height', '?')}\n"
        )

    prompt = f"""You are an AI content analyst for Creator Zone.

Analyze this video transcript and metadata to generate actionable insight cards for the creator.
{meta_section}
Transcript:
{transcript_text[:4000]}

Generate 2-5 insight cards. Respond ONLY with a valid JSON array (no markdown, no code blocks):
[
  {{
    "type": "quality|opportunity|visual|cross_platform",
    "message": "Concise actionable suggestion in Italian (max 120 chars)",
    "action_tool": "tool_id or null",
    "action_params": {{}},
    "confidence": 0.0
  }}
]

Insight types:
- quality: Audio/video quality issues (silence, loudness, bitrate)
- opportunity: Content opportunities found in transcript (key topics, highlights, clip suggestions)
- visual: Visual/thumbnail suggestions based on mentioned visual moments
- cross_platform: Repurposing suggestions for other platforms

Rules:
- Write all messages in Italian
- confidence > 0.8 only when very certain
- action_tool must be one of: jumpcut, caption, thumbnail, transcribe, translate, tts, export, audio_cleanup, analyze_media, null
- Keep action_params simple and directly relevant to the insight
"""

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)
        if not isinstance(data, list):
            logger.warning("Gemini returned non-list for insights: %r", type(data))
            return []

        _ALLOWED_INSIGHT_TOOLS = {
            "jumpcut",
            "caption",
            "thumbnail",
            "transcribe",
            "translate",
            "tts",
            "export",
            "audio_cleanup",
            "analyze_media",
            None,
        }
        insights = []
        for item in data:
            action_tool = item.get("action_tool")
            if action_tool not in _ALLOWED_INSIGHT_TOOLS:
                action_tool = None
            # Only allow simple primitive values in action_params
            raw_params = item.get("action_params") or {}
            safe_params = {
                k: v
                for k, v in raw_params.items()
                if isinstance(v, (str, int, float, bool)) and len(str(v)) < 200
            }
            insights.append(
                {
                    "id": str(uuid.uuid4()),
                    "type": str(item.get("type", "opportunity")),
                    "message": str(item.get("message", ""))[:200],
                    "action_tool": action_tool,
                    "action_params": safe_params,
                    "status": "PENDING",
                    "confidence": float(item.get("confidence", 0.5)),
                }
            )
        return insights

    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON for insights: %s", exc)
        return []
    except Exception as exc:
        logger.error("Transcript analysis with Gemini failed: %s", exc)
        return []


# ── Main analysis entry point ──────────────────────────────────────────────────


def analyze_media(
    file_path: str,
    transcript_text: str | None = None,
) -> dict[str, Any]:
    """Full media analysis: FFmpeg probe + rule-based insights + optional Gemini analysis.

    Args:
        file_path: Absolute path to the media file.
        transcript_text: Optional transcript text for AI-powered insight generation.

    Returns:
        {
            "metadata": {...},           # FFmpeg probe data
            "insights": [...],           # List of InsightCard dicts
            "transcript_analyzed": bool  # Whether Gemini analyzed the transcript
        }
    """
    metadata = probe_media(file_path)
    rule_insights = generate_rule_based_insights(metadata)
    transcript_analyzed = False

    if transcript_text and len(transcript_text.strip()) > 50:
        ai_insights = analyze_transcript_with_gemini(transcript_text, metadata)
        if ai_insights:
            # Merge: prefer AI insights, supplement with any rule insight types not covered
            ai_types = {i["type"] for i in ai_insights}
            merged = ai_insights + [
                r for r in rule_insights if r["type"] not in ai_types
            ]
            insights = merged
            transcript_analyzed = True
        else:
            insights = rule_insights
    else:
        insights = rule_insights

    return {
        "metadata": metadata,
        "insights": insights,
        "transcript_analyzed": transcript_analyzed,
    }
