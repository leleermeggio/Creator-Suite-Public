from __future__ import annotations

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
    """Generate captions from transcription data. Placeholder — actual generation in Phase 2."""
    await _verify_project_access(body.project_id, user, db)

    caption = Caption(
        project_id=body.project_id,
        user_id=user.id,
        asset_id=body.asset_id,
        language=body.language,
        style_preset=body.style_preset,
    )
    db.add(caption)
    await db.commit()
    await db.refresh(caption)
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

    # Create translated copy (actual translation dispatched as job in Phase 2)
    translated = Caption(
        project_id=source.project_id,
        user_id=user.id,
        asset_id=source.asset_id,
        language=body.target_language,
        segments=source.segments,  # Placeholder — will be translated by service
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
