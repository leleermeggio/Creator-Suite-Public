from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.subscription import PlanTier, Subscription, SubscriptionStatus
from backend.models.user import User
from backend.services.quota_service import get_plan_limits, get_usage

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    limits: dict[str, int]
    usage: dict[str, int]


class UpgradeRequest(BaseModel):
    plan: PlanTier


@router.get("/me", response_model=SubscriptionResponse)
async def get_my_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()

    plan = "free"
    sub_status = "active"
    if sub:
        plan = sub.plan.value if isinstance(sub.plan, PlanTier) else sub.plan
        sub_status = sub.status.value if isinstance(sub.status, SubscriptionStatus) else sub.status

    limits = get_plan_limits(plan)

    usage = {}
    for counter_type in ["ai_jobs_day", "exports_day"]:
        usage[counter_type] = await get_usage(user.id, counter_type, db)

    return SubscriptionResponse(plan=plan, status=sub_status, limits=limits, usage=usage)


@router.post("/upgrade", response_model=SubscriptionResponse)
async def upgrade_plan(
    body: UpgradeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()

    if sub is None:
        sub = Subscription(user_id=user.id, plan=body.plan, status=SubscriptionStatus.ACTIVE)
        db.add(sub)
    else:
        sub.plan = body.plan
        sub.status = SubscriptionStatus.ACTIVE

    await db.commit()
    await db.refresh(sub)

    plan = sub.plan.value if isinstance(sub.plan, PlanTier) else sub.plan
    limits = get_plan_limits(plan)
    usage = {}
    for counter_type in ["ai_jobs_day", "exports_day"]:
        usage[counter_type] = await get_usage(user.id, counter_type, db)

    return SubscriptionResponse(plan=plan, status="active", limits=limits, usage=usage)
