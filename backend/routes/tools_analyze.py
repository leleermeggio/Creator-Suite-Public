from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user
from backend.middleware.rate_limit import limiter
from backend.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tools"])

_MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


class AnalyzeMediaResponse(BaseModel):
    metadata: dict
    insights: list[dict]
    transcript_analyzed: bool


@router.post("/tools/analyze-media", response_model=AnalyzeMediaResponse)
@limiter.limit("20/minute")
async def analyze_media_endpoint(
    request: Request,
    file: UploadFile = File(...),
    transcript: str | None = None,
    _user: User = Depends(get_current_user),
):
    """Analyze a media file: FFmpeg probe + rule-based insights + optional Gemini."""
    from backend.services.media_analysis_service import analyze_media

    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    safe_name = os.path.basename(file.filename or "upload.bin")
    tmp_dir = tempfile.mkdtemp(prefix="analyze_")
    file_path = os.path.join(tmp_dir, safe_name)

    try:
        with open(file_path, "wb") as f:
            f.write(content)

        result = await asyncio.to_thread(analyze_media, file_path, transcript)
        return result

    except Exception:
        logger.error("❌ Media analysis failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Media analysis failed",
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
