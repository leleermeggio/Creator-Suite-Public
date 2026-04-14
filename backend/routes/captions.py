from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.caption import Caption
from backend.models.enums import JobStatus, JobType
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.caption import (
    CaptionCreate,
    CaptionResponse,
    CaptionUpdate,
    TranslateRequest,
)
from backend.services.translation_service import translate_segments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/captions", tags=["captions"])


async def _verify_project_access(
    project_id: str, user: User, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post(
    "/generate", response_model=CaptionResponse, status_code=status.HTTP_201_CREATED
)
async def generate_captions(
    body: CaptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate captions.

    - If ``segments`` are provided (output from transcriber_service), stores them directly.
    - If only ``asset_id`` is given, dispatches a transcription job to Celery and
      returns the Caption record with ``segments=null`` (poll until populated).
    """
    await _verify_project_access(body.project_id, user, db)

    # Validate asset exists if provided
    if body.asset_id:
        from backend.models.media_asset import MediaAsset

        result = await db.execute(
            select(MediaAsset).where(
                MediaAsset.id == body.asset_id,
                MediaAsset.user_id == user.id,
                MediaAsset.project_id == body.project_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Media asset not found")

    try:
        caption = Caption(
            project_id=body.project_id,
            user_id=user.id,
            asset_id=body.asset_id,
            language=body.language,
            style_preset=body.style_preset,
            segments=body.segments,
        )
        db.add(caption)
        await db.commit()
        await db.refresh(caption)
    except Exception as e:
        logger.error("Failed to create caption record: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    if body.segments is None and body.asset_id:
        from backend.workers.tasks import process_job

        try:
            process_job.delay(
                job_id=str(caption.id),
                job_type="transcribe",
                input_params={
                    "asset_id": body.asset_id,
                    "language": body.language,
                    "caption_id": str(caption.id),
                },
            )
        except Exception as e:
            logger.error("Failed to queue transcription job: %s", e)
            raise HTTPException(status_code=503, detail="Task queue unavailable")

    return caption


@router.get("/", response_model=list[CaptionResponse])
async def list_captions(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)

    result = await db.execute(
        select(Caption)
        .where(Caption.project_id == project_id, Caption.user_id == user.id)
        .order_by(Caption.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{caption_id}", response_model=CaptionResponse)
async def get_caption(
    caption_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Caption).where(Caption.id == caption_id, Caption.user_id == user.id)
    )
    caption = result.scalar_one_or_none()
    if not caption:
        raise HTTPException(status_code=404, detail="Caption not found")
    return caption


@router.put("/{caption_id}", response_model=CaptionResponse)
async def update_caption(
    caption_id: str,
    body: CaptionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Caption).where(Caption.id == caption_id, Caption.user_id == user.id)
    )
    caption = result.scalar_one_or_none()
    if not caption:
        raise HTTPException(status_code=404, detail="Caption not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(caption, key, value)
    caption.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(caption)
    return caption


@router.post(
    "/{caption_id}/translate",
    response_model=CaptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def translate_caption(
    caption_id: str,
    body: TranslateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Translate caption to target language. Creates a new Caption record."""
    result = await db.execute(
        select(Caption).where(Caption.id == caption_id, Caption.user_id == user.id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Caption not found")

    try:
        translated_segments = await asyncio.to_thread(
            translate_segments,
            source.segments or [],
            body.target_language,
        )
    except Exception as exc:
        logger.error(
            "❌ Translation service failed for caption %s: %s", caption_id, exc
        )
        raise HTTPException(status_code=502, detail="Translation service unavailable")

    translated = Caption(
        project_id=source.project_id,
        user_id=user.id,
        asset_id=source.asset_id,
        language=body.target_language,
        segments=translated_segments,
        style_preset=source.style_preset,
        font_family=source.font_family,
        font_size=source.font_size,
        color=source.color,
        bg_color=source.bg_color,
        position=source.position,
    )
    db.add(translated)
    await db.commit()
    await db.refresh(translated)
    return translated


@router.post("/{caption_id}/burn-in", status_code=status.HTTP_202_ACCEPTED)
async def burn_in_captions(
    caption_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Burn captions into the source video. Creates an async job."""
    result = await db.execute(
        select(Caption).where(Caption.id == caption_id, Caption.user_id == user.id)
    )
    caption = result.scalar_one_or_none()
    if not caption:
        raise HTTPException(status_code=404, detail="Caption not found")

    job = Job(
        project_id=caption.project_id,
        user_id=user.id,
        type=JobType.CAPTION,
        status=JobStatus.QUEUED,
        input_params={
            "caption_id": caption.id,
            "asset_id": caption.asset_id,
            "style_preset": caption.style_preset,
            "font_family": caption.font_family,
            "font_size": caption.font_size,
            "color": caption.color,
            "bg_color": caption.bg_color,
            "position": caption.position,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}
