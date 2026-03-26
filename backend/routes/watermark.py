from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.enums import JobStatus, JobType
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User

router = APIRouter(prefix="/watermark", tags=["watermark"])


class ImageWatermarkRequest(BaseModel):
    project_id: str
    asset_id: str
    watermark_storage_key: str
    position: str = "bottom_right"
    opacity: float = Field(default=0.5, ge=0.0, le=1.0)
    scale: float = Field(default=0.15, gt=0.0, le=1.0)


class TextWatermarkRequest(BaseModel):
    project_id: str
    asset_id: str
    text: str = Field(min_length=1, max_length=200)
    position: str = "bottom_right"
    font_size: int = Field(default=24, ge=8, le=120)
    color: str = "white"
    opacity: float = Field(default=0.5, ge=0.0, le=1.0)


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


@router.post("/image", status_code=status.HTTP_202_ACCEPTED)
async def add_image_watermark(
    body: ImageWatermarkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add image watermark to video. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.THUMBNAIL,
        status=JobStatus.QUEUED,
        input_params={
            "action": "watermark_image",
            "asset_id": body.asset_id,
            "watermark_storage_key": body.watermark_storage_key,
            "position": body.position,
            "opacity": body.opacity,
            "scale": body.scale,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}


@router.post("/text", status_code=status.HTTP_202_ACCEPTED)
async def add_text_watermark(
    body: TextWatermarkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add text watermark to video. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.THUMBNAIL,
        status=JobStatus.QUEUED,
        input_params={
            "action": "watermark_text",
            "asset_id": body.asset_id,
            "text": body.text,
            "position": body.position,
            "font_size": body.font_size,
            "color": body.color,
            "opacity": body.opacity,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}
