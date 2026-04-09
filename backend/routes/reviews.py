from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.project import Project
from backend.models.review import Review, ReviewStatus
from backend.models.user import User

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    project_id: str = Field(min_length=1)
    export_id: str | None = None
    reviewer_id: str = Field(min_length=1)
    notes: str | None = None


class ReviewRespond(BaseModel):
    status: ReviewStatus
    notes: str | None = None


class ReviewResponse(BaseModel):
    id: str
    project_id: str
    export_id: str | None
    requester_id: str
    reviewer_id: str
    status: ReviewStatus
    notes: str | None
    created_at: datetime
    responded_at: datetime | None
    model_config = {"from_attributes": True}


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def request_review(
    body: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    review = Review(
        project_id=body.project_id,
        export_id=body.export_id,
        requester_id=user.id,
        reviewer_id=body.reviewer_id,
        notes=body.notes,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


@router.get("/", response_model=list[ReviewResponse])
async def list_reviews(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review)
        .where(Review.project_id == project_id)
        .order_by(Review.created_at.desc())
    )
    return list(result.scalars().all())


@router.put("/{review_id}", response_model=ReviewResponse)
async def respond_to_review(
    review_id: str,
    body: ReviewRespond,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review).where(Review.id == review_id, Review.reviewer_id == user.id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.status = body.status
    if body.notes is not None:
        review.notes = body.notes
    review.responded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(review)
    return review
