from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User
from backend.services.smart_search_service import search_with_gemini

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=1, max_length=500)


class SearchResult(BaseModel):
    asset_id: str
    start: float
    end: float
    text: str
    relevance_score: float


@router.post("/", response_model=list[SearchResult])
async def search_project(
    body: SearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search across all transcriptions in a project."""
    result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Gather completed transcription jobs for this project
    result = await db.execute(
        select(Job).where(
            Job.project_id == body.project_id,
            Job.user_id == user.id,
            Job.type == "transcribe",
            Job.status == "completed",
        )
    )
    jobs = result.scalars().all()

    transcriptions = []
    for job in jobs:
        if job.result and "segments" in job.result:
            transcriptions.append(
                {
                    "asset_id": job.input_params.get("asset_id", job.id)
                    if job.input_params
                    else job.id,
                    "segments": job.result["segments"],
                }
            )

    if not transcriptions:
        return []

    results = await search_with_gemini(body.query, transcriptions)
    return [SearchResult(**r) for r in results]
