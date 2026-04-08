from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.subscription import PlanTier, Subscription, UsageCounter

logger = logging.getLogger(__name__)

PLAN_LIMITS: dict[str, dict[str, int]] = {
    "free": {
        "ai_jobs_day": 100,
        "exports_day": 10,
        "storage_gb": 50,
        "concurrent_jobs": 3,
        "projects": 5,
    },
    "pro": {
        "ai_jobs_day": 1000,
        "exports_day": -1,  # unlimited
        "storage_gb": 500,
        "concurrent_jobs": 10,
        "projects": -1,
    },
    "team": {
        "ai_jobs_day": 5000,
        "exports_day": -1,
        "storage_gb": 2000,
        "concurrent_jobs": 20,
        "projects": -1,
    },
}


def get_plan_limits(plan: str) -> dict[str, int]:
    """Return limits for the given plan tier."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


async def get_user_plan(user_id: str, db: AsyncSession) -> str:
    """Get the user's current plan tier. Defaults to 'free'."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()
    if not sub or sub.status != "active":
        return "free"
    return sub.plan.value if isinstance(sub.plan, PlanTier) else sub.plan


async def get_usage(user_id: str, counter_type: str, db: AsyncSession) -> int:
    """Get current usage count for a counter type."""
    result = await db.execute(
        select(UsageCounter).where(
            UsageCounter.user_id == user_id,
            UsageCounter.counter_type == counter_type,
        )
    )
    counter = result.scalar_one_or_none()
    return counter.current_value if counter else 0


async def increment_usage(
    user_id: str, counter_type: str, db: AsyncSession, amount: int = 1
) -> int:
    """Increment a usage counter. Creates the counter if it doesn't exist.

    Returns the new value.
    """
    result = await db.execute(
        select(UsageCounter).where(
            UsageCounter.user_id == user_id,
            UsageCounter.counter_type == counter_type,
        )
    )
    counter = result.scalar_one_or_none()

    if counter is None:
        counter = UsageCounter(
            user_id=user_id,
            counter_type=counter_type,
            current_value=amount,
        )
        db.add(counter)
    else:
        counter.current_value += amount

    await db.flush()
    return counter.current_value


async def check_quota(
    user_id: str, counter_type: str, db: AsyncSession
) -> tuple[bool, int, int]:
    """Check if user is within quota for a given counter type.

    Returns:
        (allowed, current_usage, limit)
        limit of -1 means unlimited.
    """
    plan = await get_user_plan(user_id, db)
    limits = get_plan_limits(plan)
    limit = limits.get(counter_type, -1)

    if limit == -1:
        return (True, 0, -1)

    current = await get_usage(user_id, counter_type, db)
    return (current < limit, current, limit)


async def reset_daily_counters(db: AsyncSession) -> int:
    """Reset all daily usage counters. Called by Celery Beat scheduler.

    Returns number of counters reset.
    """
    daily_types = {"ai_jobs_day", "exports_day"}
    result = await db.execute(
        select(UsageCounter).where(UsageCounter.counter_type.in_(daily_types))
    )
    counters = result.scalars().all()
    count = 0
    for counter in counters:
        counter.current_value = 0
        counter.period_start = datetime.now(timezone.utc)
        count += 1
    await db.flush()
    return count
