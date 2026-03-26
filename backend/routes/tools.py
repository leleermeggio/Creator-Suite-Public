from __future__ import annotations

import asyncio
import logging

import httpx
from deep_translator import GoogleTranslator
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth.dependencies import get_current_user
from backend.config import get_settings
from backend.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tools"])


# ── Request / Response schemas ────────────────────────────────────────────────


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    target_language: str = Field(min_length=2, max_length=10)
    provider: str | None = None
    api_key: str | None = None
    model: str | None = None


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    provider: str | None = None
    api_key: str | None = None
    model: str | None = None


class OcrRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=5_000_000)
    provider: str | None = None
    api_key: str | None = None
    model: str | None = None


class ToolResult(BaseModel):
    result: str


# ── Provider URLs ─────────────────────────────────────────────────────────────

POLLINATIONS_URL = "https://text.pollinations.ai/openai"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OCR_SPACE_URL = "https://api.ocr.space/parse/image"


# ── Unified OpenAI-compatible helper ─────────────────────────────────────────


async def _call_openai_compatible(
    client: httpx.AsyncClient,
    url: str,
    model: str,
    system_prompt: str,
    user_content: str | list,
    api_key: str | None = None,
) -> str:
    """Call any OpenAI-compatible API (Pollinations, Groq, OpenRouter)."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }
    resp = await client.post(url, json=payload, headers=headers, timeout=60.0)
    if not resp.is_success:
        logger.error(
            "❌ OpenAI-compat HTTP %s (%s) — body: %s",
            resp.status_code,
            url,
            resp.text[:500],
        )
        resp.raise_for_status()

    data = resp.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not text:
        raise ValueError("Empty response from AI provider")
    return text


# ── Gemini helper (custom API format) ────────────────────────────────────────


async def _call_gemini(
    client: httpx.AsyncClient,
    api_key: str,
    model: str,
    system_prompt: str,
    user_content: str | list,
) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    contents: list = []
    if isinstance(user_content, str):
        contents = [{"role": "user", "parts": [{"text": user_content}]}]
    else:
        contents = [{"role": "user", "parts": user_content}]

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
    }
    resp = await client.post(url, json=payload, timeout=30.0)
    if not resp.is_success:
        logger.error("❌ Gemini HTTP %s — body: %s", resp.status_code, resp.text[:500])
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates")
    if not candidates:
        block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
        raise ValueError(f"Gemini returned no candidates (blockReason={block_reason})")
    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
    if not text:
        raise ValueError("Empty text in Gemini response")
    return text


# ── OCR.space helper (free, no API key) ──────────────────────────────────────


async def _call_ocr_space(
    client: httpx.AsyncClient,
    image_base64: str,
    language: str = "ita",
) -> str:
    """Call OCR.space free API."""
    resp = await client.post(
        OCR_SPACE_URL,
        data={
            "base64Image": f"data:image/jpeg;base64,{image_base64}",
            "language": language,
            "isOverlayRequired": "false",
            "OCREngine": "2",
        },
        headers={"apikey": "helloworld"},
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("IsErroredOnProcessing"):
        error_msg = data.get("ErrorMessage", ["OCR processing error"])
        raise ValueError(f"OCR.space error: {error_msg}")
    results = data.get("ParsedResults", [])
    if not results:
        raise ValueError("OCR returned no results")
    text = results[0].get("ParsedText", "").strip()
    if not text:
        raise ValueError("No text found in image")
    return text


# ── Provider dispatch ────────────────────────────────────────────────────────


async def _call_ai(
    client: httpx.AsyncClient,
    provider: str,
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str | list,
) -> str:
    """Route to the correct AI provider."""
    if provider == "gemini":
        if not api_key:
            raise ValueError("Gemini requires a Google API key.")
        return await _call_gemini(client, api_key, model, system_prompt, user_content)
    elif provider == "groq":
        if not api_key:
            raise ValueError(
                "Groq requires an API key. Get one free at console.groq.com"
            )
        return await _call_openai_compatible(
            client, GROQ_URL, model, system_prompt, user_content, api_key
        )
    elif provider == "openrouter":
        if not api_key:
            raise ValueError(
                "OpenRouter requires an API key. Get one free at openrouter.ai"
            )
        return await _call_openai_compatible(
            client, OPENROUTER_URL, model, system_prompt, user_content, api_key
        )
    else:
        # Pollinations (default, no key needed)
        return await _call_openai_compatible(
            client, POLLINATIONS_URL, model, system_prompt, user_content
        )


def _resolve_provider(
    body_provider: str | None, body_api_key: str | None
) -> tuple[str, str | None, str]:
    """Determine provider, api_key, and default model from request + settings."""
    settings = get_settings()
    provider = body_provider or "pollinations"

    if provider == "gemini":
        key = body_api_key or settings.GOOGLE_API_KEY
        model_default = settings.GEMINI_MODEL
    elif provider == "groq":
        key = body_api_key
        model_default = "llama-3.3-70b-versatile"
    elif provider == "openrouter":
        key = body_api_key
        model_default = "meta-llama/llama-3.1-8b-instruct:free"
    else:
        key = None
        model_default = "openai"

    return provider, key, model_default


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/translate", response_model=ToolResult)
async def translate(
    body: TranslateRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    provider, api_key, default_model = _resolve_provider(body.provider, body.api_key)
    model = body.model or default_model
    system_prompt = (
        f"You are a translator. Translate the text to {body.target_language}. "
        "Return ONLY the translation, nothing else."
    )

    async with httpx.AsyncClient() as client:
        # Try selected provider
        try:
            translated = await _call_ai(
                client, provider, api_key, model, system_prompt, body.text
            )
            return ToolResult(result=translated)
        except Exception as exc:
            logger.warning("⚠️ %s translate failed, trying fallbacks: %s", provider, exc)

        # Fallback: Pollinations (if not already the primary)
        if provider != "pollinations":
            try:
                translated = await _call_openai_compatible(
                    client,
                    POLLINATIONS_URL,
                    "openai",
                    system_prompt,
                    body.text,
                )
                return ToolResult(result=translated)
            except Exception as exc:
                logger.warning("⚠️ Pollinations translate fallback failed: %s", exc)

        # Fallback: deep-translator
        try:
            translated = await asyncio.to_thread(
                lambda: GoogleTranslator(
                    source="auto", target=body.target_language
                ).translate(body.text)
            )
            if not translated:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Translation service returned empty result.",
                )
            return ToolResult(result=translated)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="All translation services unavailable.",
            ) from exc


@router.post("/summarize", response_model=ToolResult)
async def summarize(
    body: SummarizeRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    provider, api_key, default_model = _resolve_provider(body.provider, body.api_key)
    model = body.model or default_model
    system_prompt = "Sei un assistente che riassume testi in modo conciso."
    user_prompt = (
        f"Riassumi il seguente testo in modo conciso con bullet points:\n\n{body.text}"
    )

    async with httpx.AsyncClient() as client:
        # Try selected provider
        try:
            result = await _call_ai(
                client, provider, api_key, model, system_prompt, user_prompt
            )
            return ToolResult(result=result)
        except Exception as exc:
            logger.warning("⚠️ %s summarize failed, trying fallbacks: %s", provider, exc)

        # Fallback: Pollinations (if not already the primary)
        if provider != "pollinations":
            try:
                result = await _call_openai_compatible(
                    client,
                    POLLINATIONS_URL,
                    "openai",
                    system_prompt,
                    user_prompt,
                )
                return ToolResult(result=result)
            except Exception as exc:
                logger.warning("⚠️ Pollinations summarize fallback failed: %s", exc)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI summarization service unavailable. Please try again.",
        )


@router.post("/ocr", response_model=ToolResult)
async def ocr(
    body: OcrRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    provider, api_key, default_model = _resolve_provider(body.provider, body.api_key)
    model = body.model or default_model

    async with httpx.AsyncClient() as client:
        # Gemini (vision) — best for OCR
        if provider == "gemini" and api_key:
            try:
                parts = [
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": body.image_base64,
                        }
                    },
                    {"text": "Estrai tutto il testo visibile in questa immagine."},
                ]
                result = await _call_gemini(
                    client,
                    api_key,
                    model,
                    "Sei un assistente OCR. Restituisci solo il testo estratto dall'immagine.",
                    parts,
                )
                return ToolResult(result=result)
            except Exception as exc:
                logger.warning("⚠️ Gemini OCR failed, trying OCR.space: %s", exc)

        # Groq with Llama Vision
        if provider == "groq" and api_key:
            try:
                vision_content = [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{body.image_base64}"
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all visible text from this image. Return only the extracted text.",
                    },
                ]
                result = await _call_openai_compatible(
                    client,
                    GROQ_URL,
                    "llama-3.2-11b-vision-preview",
                    "You are an OCR assistant. Extract all visible text from images.",
                    vision_content,
                    api_key,
                )
                return ToolResult(result=result)
            except Exception as exc:
                logger.warning("⚠️ Groq Vision OCR failed, trying OCR.space: %s", exc)

        # Fallback: OCR.space (free, works for all)
        try:
            result = await _call_ocr_space(client, body.image_base64)
            return ToolResult(result=result)
        except Exception as exc:
            logger.error("❌ OCR.space failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OCR service unavailable. Please try again.",
            ) from exc
