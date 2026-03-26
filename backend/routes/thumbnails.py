from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.config import get_settings
from backend.models.project import Project
from backend.models.thumbnail import Thumbnail, ThumbnailSource
from backend.models.user import User
from backend.schemas.thumbnail import (
    ThumbnailExtractRequest,
    ThumbnailGenerateRequest,
    ThumbnailResponse,
)
from backend.storage.r2 import R2Client

router = APIRouter(prefix="/thumbnails", tags=["thumbnails"])


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
    response_model=ThumbnailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def extract_frame(
    body: ThumbnailExtractRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract a frame from a video at a specific timestamp. Placeholder — actual extraction in Phase 2."""
    await _verify_project_access(body.project_id, user, db)

    thumb = Thumbnail(
        project_id=body.project_id,
        user_id=user.id,
        source_type=ThumbnailSource.FRAME_EXTRACT,
    )
    db.add(thumb)
    await db.commit()
    await db.refresh(thumb)
    return thumb


@router.post(
    "/generate", response_model=ThumbnailResponse, status_code=status.HTTP_201_CREATED
)
async def generate_thumbnail(
    body: ThumbnailGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a thumbnail using AI. Placeholder — actual generation in Phase 2."""
    await _verify_project_access(body.project_id, user, db)

    thumb = Thumbnail(
        project_id=body.project_id,
        user_id=user.id,
        source_type=ThumbnailSource.AI_GENERATED,
        prompt=body.prompt,
    )
    db.add(thumb)
    await db.commit()
    await db.refresh(thumb)
    return thumb


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
