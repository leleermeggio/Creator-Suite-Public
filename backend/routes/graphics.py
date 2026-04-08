from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.graphics_overlay import GraphicsOverlay
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.graphics_overlay import (
    OverlayCreate,
    OverlayResponse,
    OverlayUpdate,
)

router = APIRouter(prefix="/overlays", tags=["overlays"])


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


@router.post("/", response_model=OverlayResponse, status_code=status.HTTP_201_CREATED)
async def create_overlay(
    body: OverlayCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(body.project_id, user, db)

    overlay = GraphicsOverlay(
        project_id=body.project_id,
        user_id=user.id,
        overlay_type=body.overlay_type,
        name=body.name,
        x=body.x,
        y=body.y,
        width=body.width,
        height=body.height,
        start_time=body.start_time,
        end_time=body.end_time,
        properties=body.properties,
        asset_storage_key=body.asset_storage_key,
        layer_order=body.layer_order,
    )
    db.add(overlay)
    await db.commit()
    await db.refresh(overlay)
    return overlay


@router.get("/", response_model=list[OverlayResponse])
async def list_overlays(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)

    result = await db.execute(
        select(GraphicsOverlay)
        .where(
            GraphicsOverlay.project_id == project_id, GraphicsOverlay.user_id == user.id
        )
        .order_by(GraphicsOverlay.layer_order.asc(), GraphicsOverlay.created_at.asc())
    )
    return list(result.scalars().all())


@router.get("/{overlay_id}", response_model=OverlayResponse)
async def get_overlay(
    overlay_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GraphicsOverlay).where(
            GraphicsOverlay.id == overlay_id, GraphicsOverlay.user_id == user.id
        )
    )
    overlay = result.scalar_one_or_none()
    if not overlay:
        raise HTTPException(status_code=404, detail="Overlay not found")
    return overlay


@router.put("/{overlay_id}", response_model=OverlayResponse)
async def update_overlay(
    overlay_id: str,
    body: OverlayUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GraphicsOverlay).where(
            GraphicsOverlay.id == overlay_id, GraphicsOverlay.user_id == user.id
        )
    )
    overlay = result.scalar_one_or_none()
    if not overlay:
        raise HTTPException(status_code=404, detail="Overlay not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(overlay, key, value)
    overlay.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(overlay)
    return overlay


@router.delete("/{overlay_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_overlay(
    overlay_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GraphicsOverlay).where(
            GraphicsOverlay.id == overlay_id, GraphicsOverlay.user_id == user.id
        )
    )
    overlay = result.scalar_one_or_none()
    if not overlay:
        raise HTTPException(status_code=404, detail="Overlay not found")

    await db.delete(overlay)
    await db.commit()
