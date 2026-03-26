from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.config import get_settings
from backend.models.export import Export
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.export import ExportCreate, ExportResponse
from backend.storage.r2 import R2Client

router = APIRouter(prefix="/exports", tags=["exports"])


def _get_r2() -> R2Client:
    settings = get_settings()
    return R2Client(
        endpoint_url=settings.R2_ENDPOINT_URL,
        access_key_id=settings.R2_ACCESS_KEY_ID,
        secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        bucket_name=settings.R2_BUCKET_NAME,
    )


@router.post("/", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
async def create_export(
    body: ExportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    export = Export(
        project_id=body.project_id,
        user_id=user.id,
        format_preset=body.format_preset,
        aspect_ratio=body.aspect_ratio,
        resolution=body.resolution,
        codec=body.codec,
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    # TODO: Phase 1 — dispatch render job to Celery
    return export


@router.get("/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Export).where(Export.id == export_id, Export.user_id == user.id)
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    response = ExportResponse.model_validate(export)
    if export.output_storage_key:
        r2 = _get_r2()
        response.download_url = r2.generate_download_url(
            key=export.output_storage_key, expires_in=3600
        )
    return response


@router.get("/", response_model=list[ExportResponse])
async def list_exports(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Export)
        .where(Export.project_id == project_id, Export.user_id == user.id)
        .order_by(Export.created_at.desc())
    )
    return list(result.scalars().all())
