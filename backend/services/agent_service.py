from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.agent import Agent
from backend.models.enums import ControlMode

logger = logging.getLogger(__name__)

# ── Preset definitions ────────────────────────────────────────────────────────

PRESET_AGENTS: list[dict[str, Any]] = [
    {
        "preset_id": "short_video",
        "name": "Short Video",
        "icon": "🎬",
        "description": "Converti video in short ottimizzato per TikTok, Reels e Shorts.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["tiktok", "reels", "shorts"],
        "steps": [
            {
                "tool_id": "download",
                "label": "Importa Video",
                "parameters": {},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "jumpcut",
                "label": "Rimuovi Silenzi",
                "parameters": {
                    "silence_threshold": -35.0,
                    "min_silence": 0.4,
                    "padding": 0.12,
                },
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "caption",
                "label": "Genera Sottotitoli",
                "parameters": {"style": "shorts"},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "thumbnail",
                "label": "Genera Thumbnail",
                "parameters": {"style": "viral"},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta",
                "parameters": {"format": "mp4", "resolution": "1080x1920"},
                "auto_run": False,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "podcast_clip",
        "name": "Podcast Clip",
        "icon": "🎙️",
        "description": "Estrai clip salienti da podcast o interviste lunghe.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["youtube", "spotify"],
        "steps": [
            {
                "tool_id": "transcribe",
                "label": "Trascrivi",
                "parameters": {"model": "small"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "analyze_media",
                "label": "Trova Momenti Chiave",
                "parameters": {},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "caption",
                "label": "Aggiungi Sottotitoli",
                "parameters": {},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta Clip",
                "parameters": {"format": "mp4"},
                "auto_run": False,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "blog_da_video",
        "name": "Blog da Video",
        "icon": "📝",
        "description": "Converti un video in articolo blog, post LinkedIn o newsletter.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["blog", "linkedin"],
        "steps": [
            {
                "tool_id": "transcribe",
                "label": "Trascrivi",
                "parameters": {"model": "small"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "analyze_media",
                "label": "Riassumi e Struttura",
                "parameters": {"output_format": "blog"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "translate",
                "label": "Traduci (opzionale)",
                "parameters": {"target_language": "en"},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "thumbnail_pack",
        "name": "Thumbnail Pack",
        "icon": "🖼️",
        "description": "Genera 3-4 thumbnail in stili diversi dall'analisi del contenuto.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["youtube", "tiktok", "reels"],
        "steps": [
            {
                "tool_id": "analyze_media",
                "label": "Analizza Contenuto",
                "parameters": {},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "thumbnail",
                "label": "Genera Thumbnail Pack",
                "parameters": {
                    "count": 4,
                    "styles": ["bold", "minimal", "cinematic", "viral"],
                },
                "auto_run": False,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "audio_cleanup",
        "name": "Audio Cleanup",
        "icon": "🔇",
        "description": "Rimuovi rumori di fondo, normalizza l'audio e migliora la qualità.",
        "default_mode": ControlMode.AUTOPILOTA,
        "target_platforms": ["youtube", "podcast"],
        "steps": [
            {
                "tool_id": "audio_cleanup",
                "label": "Pulizia Audio",
                "parameters": {
                    "denoise": True,
                    "normalize": True,
                    "target_loudness": -14,
                },
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta",
                "parameters": {"format": "mp4"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "repurpose",
        "name": "Repurpose Content",
        "icon": "♻️",
        "description": "Trasforma un video lungo in 3-5 clip brevi con caption e thumbnail.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["tiktok", "reels", "shorts"],
        "steps": [
            {
                "tool_id": "transcribe",
                "label": "Trascrivi",
                "parameters": {"model": "small"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "analyze_media",
                "label": "Identifica Clip",
                "parameters": {"suggest_clips": True},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "jumpcut",
                "label": "Ritaglia Clip",
                "parameters": {},
                "auto_run": False,
                "required": True,
                "condition": "duration > 60",
            },
            {
                "tool_id": "caption",
                "label": "Aggiungi Caption",
                "parameters": {"style": "shorts"},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "thumbnail",
                "label": "Genera Thumbnail",
                "parameters": {},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "traduci_localizza",
        "name": "Traduci & Localizza",
        "icon": "🌍",
        "description": "Trascrivi, traduci e genera voiceover in più lingue.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["youtube", "tiktok"],
        "steps": [
            {
                "tool_id": "transcribe",
                "label": "Trascrivi",
                "parameters": {"model": "small"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "translate",
                "label": "Traduci Caption",
                "parameters": {"target_languages": ["en", "es", "fr"]},
                "auto_run": False,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "tts",
                "label": "Genera Voiceover",
                "parameters": {},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta Localizzato",
                "parameters": {"format": "mp4"},
                "auto_run": False,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "multi_platform",
        "name": "Multi-Platform Export",
        "icon": "📡",
        "description": "Un video → tutti i formati: YouTube, TikTok, Instagram con caption adattate.",
        "default_mode": ControlMode.AUTOPILOTA,
        "target_platforms": ["youtube", "tiktok", "instagram", "reels"],
        "steps": [
            {
                "tool_id": "analyze_media",
                "label": "Analizza Contenuto",
                "parameters": {},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "caption",
                "label": "Genera Caption Adattate",
                "parameters": {},
                "auto_run": True,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta per YouTube",
                "parameters": {
                    "format": "mp4",
                    "resolution": "1920x1080",
                    "platform": "youtube",
                },
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "export",
                "label": "Esporta per TikTok/Reels",
                "parameters": {
                    "format": "mp4",
                    "resolution": "1080x1920",
                    "platform": "tiktok",
                },
                "auto_run": True,
                "required": True,
                "condition": None,
            },
        ],
    },
    {
        "preset_id": "content_refresh",
        "name": "Content Refresh",
        "icon": "✨",
        "description": "Aggiorna vecchi video: nuova thumbnail, caption fresche, nuova descrizione AI.",
        "default_mode": ControlMode.COPILOTA,
        "target_platforms": ["youtube", "tiktok"],
        "steps": [
            {
                "tool_id": "download",
                "label": "Importa Video Esistente",
                "parameters": {},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "transcribe",
                "label": "Trascrivi",
                "parameters": {"model": "small"},
                "auto_run": True,
                "required": True,
                "condition": None,
            },
            {
                "tool_id": "thumbnail",
                "label": "Nuova Thumbnail",
                "parameters": {"style": "fresh"},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "caption",
                "label": "Caption Aggiornate",
                "parameters": {},
                "auto_run": False,
                "required": False,
                "condition": None,
            },
            {
                "tool_id": "analyze_media",
                "label": "Nuova Descrizione AI",
                "parameters": {"output_format": "description"},
                "auto_run": True,
                "required": False,
                "condition": None,
            },
        ],
    },
]


# ── Preset seeding ─────────────────────────────────────────────────────────────


async def seed_presets(db: AsyncSession) -> int:
    """Seed preset agents if they don't exist yet. Returns count of inserted rows."""
    inserted = 0
    for preset_data in PRESET_AGENTS:
        existing_result = await db.execute(
            select(Agent).where(Agent.preset_id == preset_data["preset_id"])
        )
        if existing_result.scalar_one_or_none():
            continue

        agent = Agent(
            user_id=None,
            name=preset_data["name"],
            icon=preset_data["icon"],
            description=preset_data["description"],
            steps=preset_data["steps"],
            default_mode=preset_data["default_mode"],
            target_platforms=preset_data["target_platforms"],
            is_preset=True,
            preset_id=preset_data["preset_id"],
        )
        db.add(agent)
        inserted += 1

    if inserted:
        await db.commit()
    return inserted


# ── AI-assisted agent generation ───────────────────────────────────────────────


async def generate_agent_from_description(
    db: AsyncSession,
    user_id: str,
    description: str,
) -> Agent:
    """Use Gemini to generate an agent pipeline from a natural language description.

    Raises ValueError if Gemini is unavailable or returns an invalid response.
    """
    from backend.services.gemini_service import _get_model

    model = _get_model()
    if not model:
        raise ValueError("Gemini API non disponibile — configura GOOGLE_API_KEY")

    prompt = f"""You are an AI video content pipeline designer for CazZone Creator Suite.

The user wants to build an automation agent with this description:
"{description}"

Available tools (use ONLY these tool_id values):
- download: Download/import media from URL
- transcribe: Transcribe audio to text (Whisper)
- jumpcut: Remove silences from video
- caption: Generate and burn-in captions/subtitles
- thumbnail: Generate AI thumbnails
- export: Export final video in target format
- audio_cleanup: Clean and normalize audio
- translate: Translate captions to other languages
- tts: Generate TTS voiceover from text
- analyze_media: Analyze media content, generate AI insights

Respond ONLY with a valid JSON object (no markdown, no code blocks) with this exact structure:
{{
  "name": "Short descriptive name (max 40 chars)",
  "icon": "Single emoji",
  "description": "One-sentence description of what this agent does",
  "default_mode": "COPILOTA",
  "target_platforms": ["platform1"],
  "steps": [
    {{
      "tool_id": "tool_name",
      "label": "Human-readable step label",
      "parameters": {{}},
      "auto_run": true,
      "required": true,
      "condition": null
    }}
  ]
}}

Rules:
- default_mode must be one of: REGISTA, COPILOTA, AUTOPILOTA
- target_platforms from: youtube, tiktok, instagram, reels, shorts, podcast, blog, linkedin, spotify
- auto_run=true for safe/non-destructive steps (transcribe, audio_cleanup, download, analyze_media)
- auto_run=false for creative steps (thumbnail, caption, export)
- Keep steps minimal — only what the user asked for
- condition is null unless duration-based (e.g. "duration > 60")
"""

    _ALLOWED_TOOL_IDS = {
        "download",
        "transcribe",
        "jumpcut",
        "caption",
        "thumbnail",
        "export",
        "audio_cleanup",
        "translate",
        "tts",
        "analyze_media",
        "convert",
    }
    _ALLOWED_MODES = {"REGISTA", "COPILOTA", "AUTOPILOTA"}
    _ALLOWED_PLATFORMS = {
        "youtube",
        "tiktok",
        "instagram",
        "reels",
        "shorts",
        "podcast",
        "blog",
        "linkedin",
        "spotify",
    }

    try:
        # generate_content is blocking — run in thread to avoid blocking the event loop
        response = await asyncio.to_thread(model.generate_content, prompt)
        raw = response.text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)

        # Validate and sanitize AI-generated steps — never trust Gemini output directly
        raw_steps = data.get("steps", [])
        if not isinstance(raw_steps, list):
            raise ValueError("AI returned invalid steps format")

        validated_steps = []
        for raw_step in raw_steps:
            if not isinstance(raw_step, dict):
                continue
            tool_id = str(raw_step.get("tool_id", ""))
            if tool_id not in _ALLOWED_TOOL_IDS:
                logger.warning(
                    "⚠️ AI returned unknown tool_id %r — skipping step", tool_id
                )
                continue
            # Only allow simple primitive values in parameters
            params = raw_step.get("parameters") or {}
            safe_params = {
                k: v
                for k, v in params.items()
                if isinstance(v, (str, int, float, bool)) and len(str(v)) < 500
            }
            # Condition must match simple comparison pattern or be null
            condition = raw_step.get("condition")
            if condition is not None:
                import re as _re_check

                if not _re_check.match(
                    r"^\w+\s*(>|<|>=|<=|==|!=)\s*\d+(?:\.\d+)?$", str(condition).strip()
                ):
                    condition = None
            validated_steps.append(
                {
                    "tool_id": tool_id,
                    "label": str(raw_step.get("label", tool_id))[:100],
                    "parameters": safe_params,
                    "auto_run": bool(raw_step.get("auto_run", False)),
                    "required": bool(raw_step.get("required", True)),
                    "condition": condition,
                }
            )

        raw_mode = str(data.get("default_mode", "COPILOTA")).upper()
        if raw_mode not in _ALLOWED_MODES:
            raw_mode = "COPILOTA"

        raw_platforms = data.get("target_platforms", [])
        safe_platforms = [
            p for p in raw_platforms if isinstance(p, str) and p in _ALLOWED_PLATFORMS
        ]

        agent = Agent(
            user_id=user_id,
            name=str(data.get("name", "Agente AI"))[:255],
            icon=str(data.get("icon", "🤖"))[:10],
            description=str(data.get("description", ""))[:1000],
            steps=validated_steps,
            default_mode=ControlMode(raw_mode),
            target_platforms=safe_platforms,
            is_preset=False,
        )
        db.add(agent)
        await db.commit()
        await db.refresh(agent)
        return agent

    except json.JSONDecodeError as exc:
        logger.error("❌ Gemini returned invalid JSON for agent generation: %s", exc)
        raise ValueError(f"AI ha restituito una risposta non valida: {exc}") from exc
    except Exception as exc:
        logger.error("❌ Agent generation failed: %s", exc)
        raise
