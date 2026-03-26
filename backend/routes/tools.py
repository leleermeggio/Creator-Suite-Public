from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth.dependencies import get_current_user
from backend.config import get_settings
from backend.models.user import User

router = APIRouter(tags=["tools"])


# ── Request / Response schemas ────────────────────────────────────────────────


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    target_language: str = Field(min_length=2, max_length=5)


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)


class OcrRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=5_000_000)


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

    async with httpx.AsyncClient() as client:
        if settings.GOOGLE_API_KEY:
            try:
                translated = await _call_gemini(
                    client=client,
                    api_key=settings.GOOGLE_API_KEY,
                    model=settings.GEMINI_MODEL,
                    system_prompt=(
                        f"You are a translator. Translate the text to {body.target_language}. "
                        "Return only the translation."
                    ),
                    user_content=body.text,
                )
                return ToolResult(result=translated)
            except Exception:
                pass  # fall through to MyMemory

        # MyMemory fallback
        resp = await client.get(
            "https://api.mymemory.translated.net/get",
            params={"q": body.text, "langpair": f"auto|{body.target_language}"},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("responseStatus") not in (200, "200"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=data.get("responseDetails", "Translation service unavailable"),
            )
        translated = data.get("responseData", {}).get("translatedText") or body.text
        return ToolResult(result=translated)


@router.post("/summarize", response_model=ToolResult)
async def summarize(
    body: SummarizeRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GOOGLE_API_KEY not configured on server",
        )

    async with httpx.AsyncClient() as client:
        try:
            result = await _call_gemini(
                client=client,
                api_key=settings.GOOGLE_API_KEY,
                model=settings.GEMINI_MODEL,
                system_prompt="Sei un assistente che riassume testi in modo conciso.",
                user_content=f"Riassumi il seguente testo in modo conciso con bullet points:\n\n{body.text}",
            )
        except (httpx.HTTPStatusError, httpx.RequestError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI service error: {exc}",
            ) from exc
    return ToolResult(result=result)


@router.post("/ocr", response_model=ToolResult)
async def ocr(
    body: OcrRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GOOGLE_API_KEY not configured on server",
        )

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
                api_key=settings.GOOGLE_API_KEY,
                model=settings.GEMINI_MODEL,
                system_prompt="Sei un assistente OCR. Restituisci solo il testo estratto dall'immagine.",
                user_content=parts,
            )
        except (httpx.HTTPStatusError, httpx.RequestError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI service error: {exc}",
            ) from exc
    return ToolResult(result=result)
