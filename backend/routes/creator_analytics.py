from __future__ import annotations

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.creator_metric import CreatorMetric
from backend.models.creator_video import CreatorVideo
from backend.models.platform_connection import PlatformConnection
from backend.models.user import User
from backend.schemas.creator_analytics import (
    CalendarDay,
    CalendarPost,
    CalendarResponse,
    DataPoint,
    MetricWithChange,
    OverviewResponse,
    PlatformOverview,
    TimeSeriesResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/creator-analytics", tags=["creator-analytics"])


def _period_to_dates(period: str) -> tuple[date, date]:
    """Convert period name to (start_date, end_date) tuple."""
    today = date.today()
    if period == "day":
        return today, today
    elif period == "week":
        return today - timedelta(days=7), today
    elif period == "month":
        return today - timedelta(days=30), today
    elif period == "year":
        return today - timedelta(days=365), today
    else:
        raise HTTPException(
            status_code=422, detail="Invalid period. Use: day, week, month, year"
        )


def _calc_change(current: float, previous: float) -> MetricWithChange:
    """Calculate metric with percentage change."""
    if previous == 0:
        pct = 100.0 if current > 0 else 0.0
    else:
        pct = round(((current - previous) / previous) * 100, 1)
    return MetricWithChange(value=current, previous_value=previous, change_percent=pct)


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _period_to_dates(period)
    duration = (end - start).days or 1
    prev_start = start - timedelta(days=duration)
    prev_end = start - timedelta(days=1)

    # Get connected platforms
    result = await db.execute(
        select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    )
    connected = [r[0] for r in result.all()]

    platforms = {}
    for platform in connected:

        async def _sum(metric_type: str, s: date, e: date) -> float:
            result = await db.execute(
                select(func.coalesce(func.sum(CreatorMetric.value), 0.0)).where(
                    CreatorMetric.user_id == user.id,
                    CreatorMetric.platform == platform,
                    CreatorMetric.metric_type == metric_type,
                    CreatorMetric.date >= s,
                    CreatorMetric.date <= e,
                    CreatorMetric.video_id.is_(None),
                )
            )
            return float(result.scalar())

        views_curr = await _sum("views", start, end)
        views_prev = await _sum("views", prev_start, prev_end)
        subs_curr = await _sum("subscribers", start, end)
        subs_prev = await _sum("subscribers", prev_start, prev_end)
        wt_curr = await _sum("watch_time", start, end)
        wt_prev = await _sum("watch_time", prev_start, prev_end)

        revenue = None
        if platform == "youtube":
            rev_curr = await _sum("revenue", start, end)
            rev_prev = await _sum("revenue", prev_start, prev_end)
            revenue = _calc_change(rev_curr, rev_prev)

        platforms[platform] = PlatformOverview(
            views=_calc_change(views_curr, views_prev),
            subscribers=_calc_change(subs_curr, subs_prev),
            revenue=revenue,
            watch_time_hours=_calc_change(wt_curr / 60.0, wt_prev / 60.0),
        )

    return OverviewResponse(period=period, platforms=platforms)


@router.get("/performance", response_model=TimeSeriesResponse)
async def performance(
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _period_to_dates(period)

    result = await db.execute(
        select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    )
    connected = [r[0] for r in result.all()]

    metric_types = ["views", "watch_time", "ctr", "avg_duration"]

    platforms = {}
    for platform in connected:
        result = await db.execute(
            select(CreatorMetric)
            .where(
                CreatorMetric.user_id == user.id,
                CreatorMetric.platform == platform,
                CreatorMetric.metric_type.in_(metric_types),
                CreatorMetric.date >= start,
                CreatorMetric.date <= end,
                CreatorMetric.video_id.is_(None),
            )
            .order_by(CreatorMetric.date)
        )
        rows = result.scalars().all()

        # Group by date
        by_date: dict[str, dict[str, float]] = {}
        for row in rows:
            d = row.date.isoformat()
            if d not in by_date:
                by_date[d] = {}
            by_date[d][row.metric_type] = row.value

        platforms[platform] = [
            DataPoint(date=d, metrics=m) for d, m in sorted(by_date.items())
        ]

    return TimeSeriesResponse(
        period=period, granularity=granularity, platforms=platforms
    )


@router.get("/growth", response_model=TimeSeriesResponse)
async def growth(
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _period_to_dates(period)

    result = await db.execute(
        select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    )
    connected = [r[0] for r in result.all()]

    platforms = {}
    for platform in connected:
        result = await db.execute(
            select(CreatorMetric)
            .where(
                CreatorMetric.user_id == user.id,
                CreatorMetric.platform == platform,
                CreatorMetric.metric_type == "subscribers",
                CreatorMetric.date >= start,
                CreatorMetric.date <= end,
                CreatorMetric.video_id.is_(None),
            )
            .order_by(CreatorMetric.date)
        )
        rows = result.scalars().all()
        platforms[platform] = [
            DataPoint(date=row.date.isoformat(), metrics={"subscribers": row.value})
            for row in rows
        ]

    return TimeSeriesResponse(
        period=period, granularity=granularity, platforms=platforms
    )


@router.get("/revenue", response_model=TimeSeriesResponse)
async def revenue(
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _period_to_dates(period)

    result = await db.execute(
        select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    )
    connected = [r[0] for r in result.all()]

    platforms = {}
    for platform in connected:
        result = await db.execute(
            select(CreatorMetric)
            .where(
                CreatorMetric.user_id == user.id,
                CreatorMetric.platform == platform,
                CreatorMetric.metric_type.in_(["revenue", "cpm", "rpm"]),
                CreatorMetric.date >= start,
                CreatorMetric.date <= end,
                CreatorMetric.video_id.is_(None),
            )
            .order_by(CreatorMetric.date)
        )
        rows = result.scalars().all()

        by_date: dict[str, dict[str, float]] = {}
        for row in rows:
            d = row.date.isoformat()
            if d not in by_date:
                by_date[d] = {}
            by_date[d][row.metric_type] = row.value

        platforms[platform] = [
            DataPoint(date=d, metrics=m) for d, m in sorted(by_date.items())
        ]

    return TimeSeriesResponse(
        period=period, granularity=granularity, platforms=platforms
    )


@router.get("/calendar", response_model=CalendarResponse)
async def calendar(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    year, mo = month.split("-")
    start = date(int(year), int(mo), 1)
    if int(mo) == 12:
        end = date(int(year) + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(int(year), int(mo) + 1, 1) - timedelta(days=1)

    result = await db.execute(
        select(CreatorVideo)
        .where(
            CreatorVideo.user_id == user.id,
            func.date(CreatorVideo.published_at) >= start,
            func.date(CreatorVideo.published_at) <= end,
        )
        .order_by(CreatorVideo.published_at)
    )
    videos = result.scalars().all()

    days_map: dict[str, list[CalendarPost]] = {}
    for v in videos:
        d = v.published_at.date().isoformat()
        if d not in days_map:
            days_map[d] = []
        days_map[d].append(
            CalendarPost(
                platform=v.platform,
                video_id=v.platform_video_id,
                title=v.title,
                views=v.views,
                thumbnail_url=v.thumbnail_url,
            )
        )

    days = [CalendarDay(date=d, posts=p) for d, p in sorted(days_map.items())]
    return CalendarResponse(month=month, days=days)


@router.post("/sync", status_code=202)
async def sync_metrics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Check user has at least one connected platform
    result = await db.execute(
        select(func.count())
        .select_from(PlatformConnection)
        .where(PlatformConnection.user_id == user.id)
    )
    count = result.scalar()
    if not count:
        raise HTTPException(status_code=404, detail="No platforms connected")

    # In production, this would enqueue a Celery task
    # For now, return a placeholder job_id
    logger.info("🔄 Metrics sync requested for user %s", user.id)
    return {"job_id": f"sync-{user.id}", "status": "queued"}
