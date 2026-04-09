from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.config import get_settings
from backend.models.media_asset import MediaAsset
from backend.models.project import Project
from backend.models.thumbnail import Thumbnail, ThumbnailSource
from backend.models.user import User
from backend.schemas.thumbnail import (
    ThumbnailExtractRequest,
    ThumbnailGenerateRequest,
    ThumbnailJobResponse,
    ThumbnailResponse,
)
from backend.storage.r2 import R2Client

router = APIRouter(prefix="/thumbnails", tags=["thumbnails"])
logger = logging.getLogger(__name__)


def _get_r2() -> R2Client:
    settings = get_settings()
    return R2Client(
        endpoint_url=settings.R2_ENDPOINT_URL,
        access_key_id=settings.R2_ACCESS_KEY_ID,
        secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        bucket_name=settings.R2_BUCKET_NAME,
    )


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
    "/extract-frame",
    response_model=ThumbnailJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def extract_frame(
    body: ThumbnailExtractRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract a frame from a video at a specific timestamp. Returns a job_id to poll."""
    await _verify_project_access(body.project_id, user, db)

    # Validate timestamp is non-negative
    if body.timestamp < 0:
        raise HTTPException(status_code=422, detail="Timestamp must be non-negative")

    # Verify the asset belongs to this user AND this project (prevents IDOR)
    asset_result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == body.asset_id,
            MediaAsset.user_id == user.id,
            MediaAsset.project_id == body.project_id,
        )
    )
    if not asset_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")

    import uuid as _uuid

    try:
        thumb = Thumbnail(
            id=str(_uuid.uuid4()),
            project_id=body.project_id,
            user_id=user.id,
            source_type=ThumbnailSource.FRAME_EXTRACT,
        )
        db.add(thumb)
        await db.commit()
    except Exception as e:
        logger.error("Failed to create thumbnail record: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    from backend.workers.tasks import process_job

    try:
        process_job.delay(
            job_id=thumb.id,
            job_type="thumbnail",
            input_params={
                "action": "extract_frame",
                "asset_id": body.asset_id,
                "timestamp": body.timestamp,
                "project_id": body.project_id,
                "user_id": user.id,
            },
        )
    except Exception as e:
        logger.error("Failed to queue thumbnail extraction job: %s", e)
        raise HTTPException(status_code=503, detail="Task queue unavailable")

    return ThumbnailJobResponse(job_id=thumb.id, status="queued")


@router.post(
    "/generate",
    response_model=ThumbnailJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_thumbnail(
    body: ThumbnailGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue a thumbnail generation job. Poll GET /jobs/{job_id} for result."""
    await _verify_project_access(body.project_id, user, db)

    # Validate title length
    if not body.title or len(body.title.strip()) == 0:
        raise HTTPException(status_code=422, detail="Title is required")
    if len(body.title) > 100:
        raise HTTPException(
            status_code=422, detail="Title must be at most 100 characters"
        )

    # Validate accent_color format (basic hex check)
    if body.accent_color and not body.accent_color.startswith("#"):
        raise HTTPException(
            status_code=422,
            detail="accent_color must be a valid hex color (e.g., #FF0000)",
        )

    import uuid as _uuid

    try:
        thumb = Thumbnail(
            id=str(_uuid.uuid4()),
            project_id=body.project_id,
            user_id=user.id,
            source_type=ThumbnailSource.AI_GENERATED,
            prompt=body.title,
            template_id=body.template_id,
        )
        db.add(thumb)
        await db.commit()
    except Exception as e:
        logger.error("Failed to create thumbnail record: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    from backend.workers.tasks import process_job

    try:
        process_job.delay(
            job_id=thumb.id,
            job_type="thumbnail",
            input_params={
                "action": "generate_thumbnail",
                "template_id": body.template_id,
                "title": body.title,
                "subtitle": body.subtitle,
                "accent_color": body.accent_color,
                "subject_photo_b64": body.subject_photo_b64,
            },
        )
    except Exception as e:
        logger.error("Failed to queue thumbnail generation job: %s", e)
        raise HTTPException(status_code=503, detail="Task queue unavailable")

    return ThumbnailJobResponse(job_id=thumb.id, status="queued")


@router.get("/", response_model=list[ThumbnailResponse])
async def list_thumbnails(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)

    result = await db.execute(
        select(Thumbnail)
        .where(Thumbnail.project_id == project_id, Thumbnail.user_id == user.id)
        .order_by(Thumbnail.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{thumbnail_id}", response_model=ThumbnailResponse)
async def get_thumbnail(
    thumbnail_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Thumbnail).where(
            Thumbnail.id == thumbnail_id, Thumbnail.user_id == user.id
        )
    )
    thumb = result.scalar_one_or_none()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    response = ThumbnailResponse.model_validate(thumb)
    if thumb.storage_key:
        r2 = _get_r2()
        response.download_url = r2.generate_download_url(
            key=thumb.storage_key, expires_in=300
        )
    return response
