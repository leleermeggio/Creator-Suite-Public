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
    api_key: str | None = None
    model: str | None = None


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    api_key: str | None = None
    model: str | None = None


class OcrRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=5_000_000)
    api_key: str | None = None
    model: str | None = None


class ToolResult(BaseModel):
    result: str


# ── Gemini helper ─────────────────────────────────────────────────────────────


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
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates")
    if not candidates:
        # Safety-blocked or empty response
        block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
        raise ValueError(f"Gemini returned no candidates (blockReason={block_reason})")
    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
    if not text:
        raise ValueError("Empty text in Gemini response")
    return text


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/translate", response_model=ToolResult)
async def translate(
    body: TranslateRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY

    async with httpx.AsyncClient() as client:
        if api_key:
            try:
                translated = await _call_gemini(
                    client=client,
                    api_key=api_key,
                    model=body.model or settings.GEMINI_MODEL,
                    system_prompt=(
                        f"You are a translator. Translate the text to {body.target_language}. "
                        "Return only the translation."
                    ),
                    user_content=body.text,
                )
                return ToolResult(result=translated)
            except Exception as exc:
                logger.warning("⚠️ Gemini translate failed, falling back to deep-translator: %s", exc)

        # Fallback: deep-translator with auto language detection
        try:
            translated = await asyncio.to_thread(
                lambda: GoogleTranslator(source="auto", target=body.target_language).translate(body.text)
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
                detail="Translation service unavailable.",
            ) from exc


@router.post("/summarize", response_model=ToolResult)
async def summarize(
    body: SummarizeRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google API key required. Add it in Settings.",
        )

    model = body.model or settings.GEMINI_MODEL
    async with httpx.AsyncClient() as client:
        try:
            result = await _call_gemini(
                client=client,
                api_key=api_key,
                model=model,
                system_prompt="Sei un assistente che riassume testi in modo conciso.",
                user_content=f"Riassumi il seguente testo in modo conciso con bullet points:\n\n{body.text}",
            )
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            if code == 429:
                detail = "Too many requests. Please try again in a few seconds."
            elif code == 404:
                detail = f"Model '{model}' not available. Change the model in Settings."
            elif code == 400:
                detail = "Request rejected by Gemini (400). Check your API key or the request content."
            else:
                detail = f"Gemini error {code}. Please try again."
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI service unreachable. Please try again.",
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return ToolResult(result=result)


@router.post("/ocr", response_model=ToolResult)
async def ocr(
    body: OcrRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google API key required. Add it in Settings.",
        )

    model = body.model or settings.GEMINI_MODEL
    parts = [
        {
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": body.image_base64,
            }
        },
        {"text": "Estrai tutto il testo visibile in questa immagine."},
    ]

    async with httpx.AsyncClient() as client:
        try:
            result = await _call_gemini(
                client=client,
                api_key=api_key,
                model=model,
                system_prompt="Sei un assistente OCR. Restituisci solo il testo estratto dall'immagine.",
                user_content=parts,
            )
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            if code == 429:
                detail = "Too many requests. Please try again in a few seconds."
            elif code == 404:
                detail = f"Model '{model}' not available. Change the model in Settings."
            elif code == 400:
                detail = "Request rejected by Gemini (400). Check your API key or the request content."
            else:
                detail = f"Gemini error {code}. Please try again."
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI service unreachable. Please try again.",
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return ToolResult(result=result)
