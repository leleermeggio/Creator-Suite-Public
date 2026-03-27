from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile

import httpx
from deep_translator import GoogleTranslator
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

import base64

from backend.auth.dependencies import get_current_user
from backend.config import get_settings
from backend.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tools"])


# ── Jumpcut endpoint ─────────────────────────────────────────────────────────


@router.post("/jumpcut")
async def jumpcut(
    file: UploadFile | None = File(None),
    url: str | None = Query(None, description="URL to download media from"),
    silence_threshold: float = Query(-35.0, description="Silence threshold in dB"),
    min_silence: float = Query(0.4, description="Min silence duration (seconds)"),
    padding: float = Query(0.12, description="Padding around speech (seconds)"),
    _user: User = Depends(get_current_user),
) -> FileResponse:
    """Upload a media file or provide URL, remove silences, return the processed file."""
    from backend.services.jumpcut_service import check_ffmpeg, process_jumpcut

    if not file and not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fornisci un file o un URL.",
        )

    if not check_ffmpeg():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ffmpeg non è installato sul server.",
        )

    tmp_dir = tempfile.mkdtemp(prefix="jc_upload_")
    try:
        # Download from URL or save uploaded file
        if url:
            logger.info("Downloading from URL: %s", url)
            # Add browser-like headers to bypass anti-bot protection
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": url.rsplit('/', 1)[0] + "/",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
            async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                # Try to get filename from Content-Disposition or URL
                cd = resp.headers.get("content-disposition", "")
                filename = None
                if "filename=" in cd:
                    filename = cd.split("filename=")[-1].strip('"\'')
                if not filename:
                    filename = url.split("/")[-1].split("?")[0] or "download.mp4"
                ext = os.path.splitext(filename)[1] or ".mp4"
                input_path = os.path.join(tmp_dir, f"input{ext}")
                with open(input_path, "wb") as f:
                    f.write(resp.content)
                stem = os.path.splitext(filename)[0]
        else:
            # Save uploaded file
            ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
            input_path = os.path.join(tmp_dir, f"input{ext}")
            with open(input_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            stem = os.path.splitext(file.filename or "video")[0]

        # Process in a thread to avoid blocking the event loop
        result = await asyncio.to_thread(
            process_jumpcut,
            input_path,
            tmp_dir,
            noise_db=silence_threshold,
            min_silence=min_silence,
            padding=padding,
        )

        if result.error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.error,
            )

        if not result.output_path or not os.path.exists(result.output_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Jumpcut output file not found.",
            )

        # stem was already set correctly in URL or file mode above
        download_name = f"{stem}_jumpcut{ext}"

        # Cleanup tmp dir after response is sent
        def cleanup():
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass

        return FileResponse(
            path=result.output_path,
            filename=download_name,
            media_type="application/octet-stream",
            headers={
                "X-Original-Duration": f"{result.original_duration:.2f}",
                "X-Final-Duration": f"{result.final_duration:.2f}",
                "X-Removed-Pct": f"{result.removed_pct:.1f}",
                "X-Segments-Count": str(result.segments_count),
            },
            background=BackgroundTask(cleanup),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Jumpcut error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante il jumpcut: {exc}",
        ) from exc


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


class GenerateImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=768, ge=256, le=2048)
    model: str | None = None
    provider: str | None = None
    api_key: str | None = None


class GenerateImageResult(BaseModel):
    image_base64: str
    mime_type: str = "image/webp"


# ── Provider URLs ─────────────────────────────────────────────────────────────

POLLINATIONS_URL = "https://text.pollinations.ai/openai"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OCR_SPACE_URL = "https://api.ocr.space/parse/image"
STABLE_HORDE_URL = "https://aihorde.net/api/v2"
NANOBANANA_URL = "https://www.nananobanana.com/api/v1"


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


# ── NanoBanana image generation (requires API key) ──────────────────────────


async def _nanobanana_generate(
    client: httpx.AsyncClient,
    prompt: str,
    width: int,
    height: int,
    api_key: str,
    model: str = "nano-banana",
) -> str:
    """Call NanoBanana API for image generation. Returns base64 image."""
    # Determine aspect ratio based on dimensions
    w, h = width, height
    ratio = w / h
    if 0.9 <= ratio <= 1.1:
        aspect_ratio = "1:1"
    elif ratio > 1.3:
        aspect_ratio = "16:9"
    elif ratio < 0.8:
        aspect_ratio = "9:16"
    else:
        aspect_ratio = "default"

    payload = {
        "prompt": prompt,
        "selectedModel": model,
        "aspectRatio": aspect_ratio,
        "mode": "sync",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    resp = await client.post(
        f"{NANOBANANA_URL}/generate",
        json=payload,
        headers=headers,
        timeout=90.0,
    )
    resp.raise_for_status()
    data = resp.json()

    # Get image URL from response
    output_urls = data.get("data", {}).get("outputImageUrls", [])
    if not output_urls:
        raise ValueError("NanoBanana returned no image URLs")

    image_url = output_urls[0]

    # Download image and convert to base64
    img_resp = await client.get(image_url, timeout=30.0)
    img_resp.raise_for_status()

    image_b64 = base64.b64encode(img_resp.content).decode("utf-8")
    return image_b64


# ── Stable Horde image generation (free, anonymous) ──────────────────────────

async def _stable_horde_generate(
    client: httpx.AsyncClient,
    prompt: str,
    width: int,
    height: int,
    model: str = "DreamShaper",
) -> str:
    """Submit and poll Stable Horde for image generation. Returns base64 PNG image."""
    # Stable Horde requires multiples of 64, cap at 768 for speed
    w = max(512, min(768, (width // 64) * 64))
    h = max(512, min(768, (height // 64) * 64))

    quality_suffix = (
        ", highly detailed, masterpiece, best quality, sharp focus, professional, "
        "8k uhd, photorealistic"
    )
    negative = (
        "blurry, ugly, deformed, poorly drawn, bad anatomy, extra limbs, "
        "watermark, signature, text, low quality, worst quality, nsfw"
    )

    submit_resp = await client.post(
        f"{STABLE_HORDE_URL}/generate/async",
        json={
            "prompt": prompt + quality_suffix + " ### " + negative,
            "params": {
                "width": w,
                "height": h,
                "steps": 25,
                "n": 1,
                "sampler_name": "k_dpmpp_2m",
                "cfg_scale": 7.5,
                "karras": True,
            },
            "models": [model],
            "r2": False,
            "shared": True,
        },
        headers={"apikey": "0000000000", "Client-Agent": "CazZoneCreatorSuite:1.0"},
        timeout=30.0,
    )
    submit_resp.raise_for_status()
    job_id = submit_resp.json().get("id")
    if not job_id:
        raise ValueError("Stable Horde did not return a job ID")

    logger.info("🎨 Stable Horde job submitted: %s", job_id)

    # Poll until done (max 120 seconds)
    for attempt in range(24):
        await asyncio.sleep(5)
        check = await client.get(
            f"{STABLE_HORDE_URL}/generate/check/{job_id}",
            headers={"apikey": "0000000000"},
            timeout=10.0,
        )
        check.raise_for_status()
        check_data = check.json()
        if check_data.get("done"):
            break
        queue_pos = check_data.get("queue_position", "?")
        logger.info("🎨 Waiting for Stable Horde job... queue pos=%s attempt=%d", queue_pos, attempt)
    else:
        raise ValueError("Stable Horde job timed out after 120 seconds")

    status_resp = await client.get(
        f"{STABLE_HORDE_URL}/generate/status/{job_id}",
        headers={"apikey": "0000000000"},
        timeout=30.0,
    )
    status_resp.raise_for_status()
    generations = status_resp.json().get("generations", [])
    if not generations:
        raise ValueError("Stable Horde returned no generations")

    img_data = generations[0].get("img")
    if not img_data:
        raise ValueError("Stable Horde generation has no image data")

    # img is already base64
    return img_data


@router.post("/generate-image", response_model=GenerateImageResult)
async def generate_image(
    body: GenerateImageRequest,
    _user: User = Depends(get_current_user),
) -> GenerateImageResult:
    provider = body.provider or "stable-horde"
    
    async with httpx.AsyncClient() as client:
        try:
            # NanoBanana (requires API key)
            if provider == "nanobanana":
                if not body.api_key:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="NanoBanana requires an API key. Get one free at nanobananaapi.ai",
                    )
                model = body.model or "nano-banana"
                image_b64 = await _nanobanana_generate(
                    client, body.prompt, body.width, body.height, body.api_key, model,
                )
                return GenerateImageResult(image_base64=image_b64, mime_type="image/png")
            
            # Stable Horde (default, free, no key needed)
            else:
                model = body.model or "Deliberate"
                image_b64 = await _stable_horde_generate(
                    client, body.prompt, body.width, body.height, model,
                )
                return GenerateImageResult(image_base64=image_b64, mime_type="image/png")
                
        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("❌ %s HTTP error %s: %s", provider, exc.response.status_code, exc.response.text[:300])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"{provider} service unavailable. Please try again.",
            ) from exc
        except Exception as exc:
            logger.error("❌ %s image generation failed: %s", provider, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
