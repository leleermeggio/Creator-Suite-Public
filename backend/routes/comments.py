from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.comment import Comment
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.collaboration import CommentCreate, CommentResponse, CommentUpdate

router = APIRouter(prefix="/projects/{project_id}/comments", tags=["comments"])


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


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    project_id: str,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)
    comment = Comment(
        project_id=project_id,
        user_id=user.id,
        text=body.text,
        timeline_timestamp=body.timeline_timestamp,
        asset_id=body.asset_id,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("/", response_model=list[CommentResponse])
async def list_comments(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)
    result = await db.execute(
        select(Comment)
        .where(Comment.project_id == project_id)
        .order_by(Comment.created_at.asc())
    )
    return list(result.scalars().all())


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    project_id: str,
    comment_id: str,
    body: CommentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.project_id == project_id,
            Comment.user_id == user.id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if body.text is not None:
        comment.text = body.text
    comment.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(comment)
    return comment


@router.put("/{comment_id}/resolve", response_model=CommentResponse)
async def resolve_comment(
    project_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(project_id, user, db)
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id, Comment.project_id == project_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.resolved = True
    comment.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)
    return comment
