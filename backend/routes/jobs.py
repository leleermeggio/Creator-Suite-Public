from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User
from backend.middleware.rate_limit import limiter
from backend.schemas.jobs import JobCreate, JobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_job(
    request: Request,
    body: JobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify project belongs to user
    result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=body.type,
        input_params=body.input_params,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from backend.workers.tasks import process_job

    process_job.delay(
        job_id=str(job.id),
        job_type=job.type.value,
        input_params=job.input_params,
    )

    return job


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/", response_model=list[JobResponse])
async def list_jobs(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job)
        .where(Job.project_id == project_id, Job.user_id == user.id)
        .order_by(Job.created_at.desc())
    )
    return list(result.scalars().all())
