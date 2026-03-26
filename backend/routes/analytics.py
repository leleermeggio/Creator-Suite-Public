from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.analytics_event import AnalyticsEvent
from backend.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


class EventInput(BaseModel):
    event_type: str = Field(min_length=1, max_length=100)
    event_data: dict | None = None
    device_info: dict | None = None
    app_version: str | None = None


class EventBatch(BaseModel):
    events: list[EventInput] = Field(min_length=1, max_length=100)


class EventResponse(BaseModel):
    id: str
    user_id: str
    event_type: str
    event_data: dict | None
    device_info: dict | None
    app_version: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_events(
    body: EventBatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a batch of analytics events (up to 100)."""
    records = []
    for ev in body.events:
        records.append(AnalyticsEvent(
            user_id=user.id,
            event_type=ev.event_type,
            event_data=ev.event_data,
            device_info=ev.device_info,
            app_version=ev.app_version,
        ))
    db.add_all(records)
    await db.commit()
    return {"accepted": len(records)}


@router.get("/events", response_model=list[EventResponse])
async def list_my_events(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    result = await db.execute(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.user_id == user.id)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate analytics dashboard. Returns event counts by type for the current user."""
    result = await db.execute(
        select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.user_id == user.id)
        .group_by(AnalyticsEvent.event_type)
    )
    breakdown = {row[0]: row[1] for row in result.all()}

    total = await db.execute(
        select(func.count(AnalyticsEvent.id)).where(AnalyticsEvent.user_id == user.id)
    )
    total_count = total.scalar() or 0

    return {
        "total_events": total_count,
        "by_type": breakdown,
    }
