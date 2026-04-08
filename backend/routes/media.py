from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.config import get_settings
from backend.models.enums import JobStatus, JobType
from backend.models.job import Job
from backend.models.media_asset import MediaAsset
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.media import (
    ImportURLRequest,
    MediaAssetResponse,
    RegisterAssetRequest,
    UploadURLRequest,
    UploadURLResponse,
)
from backend.middleware.rate_limit import limiter
from backend.services.media_manager import generate_storage_key, validate_content_type
from backend.storage.r2 import R2Client

router = APIRouter(prefix="/media", tags=["media"])


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


@router.post("/upload-url", response_model=UploadURLResponse)
async def get_upload_url(
    body: UploadURLRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not validate_content_type(body.content_type):
        raise HTTPException(status_code=400, detail="Unsupported media type")

    await _verify_project_access(body.project_id, user, db)

    storage_key = generate_storage_key(user.id, body.project_id, body.filename)
    r2 = _get_r2()
    upload_url = r2.generate_upload_url(
        key=storage_key, content_type=body.content_type, expires_in=900
    )
    return UploadURLResponse(upload_url=upload_url, storage_key=storage_key)


@router.post(
    "/register", response_model=MediaAssetResponse, status_code=status.HTTP_201_CREATED
)
async def register_asset(
    body: RegisterAssetRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(body.project_id, user, db)

    asset = MediaAsset(
        project_id=body.project_id,
        user_id=user.id,
        filename=body.filename,
        storage_key=body.storage_key,
        mime_type=body.mime_type,
        size_bytes=body.size_bytes,
        duration_seconds=body.duration_seconds,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/", response_model=list[MediaAssetResponse])
async def list_assets(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)

    result = await db.execute(
        select(MediaAsset)
        .where(MediaAsset.project_id == project_id, MediaAsset.user_id == user.id)
        .order_by(MediaAsset.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{asset_id}", response_model=MediaAssetResponse)
async def get_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == asset_id, MediaAsset.user_id == user.id
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    r2 = _get_r2()
    download_url = r2.generate_download_url(key=asset.storage_key, expires_in=300)
    response = MediaAssetResponse.model_validate(asset)
    response.download_url = download_url
    return response


@router.post("/import-url", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def import_from_url(
    request: Request,
    body: ImportURLRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import media from a URL (YouTube, social media, direct link). Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.DOWNLOAD,
        status=JobStatus.QUEUED,
        input_params={"url": body.url},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from backend.workers.tasks import process_job

    process_job.delay(
        job_id=str(job.id),
        job_type="download",
        input_params={"url": body.url},
    )

    return {"job_id": job.id, "status": "queued"}


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == asset_id, MediaAsset.user_id == user.id
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    await db.delete(asset)
    await db.commit()
