from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.enums import JobStatus, JobType
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User

router = APIRouter(prefix="/audio", tags=["audio"])


class AudioMixRequest(BaseModel):
    project_id: str
    track_asset_ids: list[str] = Field(min_length=1)
    volumes: list[float] | None = None


class AudioNormalizeRequest(BaseModel):
    project_id: str
    asset_id: str
    target_lufs: float = -14.0


class AudioExtractRequest(BaseModel):
    project_id: str
    asset_id: str


class TTSRequest(BaseModel):
    project_id: str
    text: str = Field(min_length=1, max_length=10000)
    language: str = "it"


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


@router.post("/mix", status_code=status.HTTP_202_ACCEPTED)
async def mix_audio(
    body: AudioMixRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mix multiple audio tracks. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.AUDIO_CLEANUP,
        status=JobStatus.QUEUED,
        input_params={
            "action": "mix",
            "track_asset_ids": body.track_asset_ids,
            "volumes": body.volumes,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}


@router.post("/normalize", status_code=status.HTTP_202_ACCEPTED)
async def normalize_audio(
    body: AudioNormalizeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Normalize audio loudness. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.AUDIO_CLEANUP,
        status=JobStatus.QUEUED,
        input_params={
            "action": "normalize",
            "asset_id": body.asset_id,
            "target_lufs": body.target_lufs,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}


@router.post("/extract", status_code=status.HTTP_202_ACCEPTED)
async def extract_audio(
    body: AudioExtractRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract audio from video. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.AUDIO_CLEANUP,
        status=JobStatus.QUEUED,
        input_params={"action": "extract", "asset_id": body.asset_id},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}


@router.post("/tts", status_code=status.HTTP_202_ACCEPTED)
async def create_tts(
    body: TTSRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate speech from text. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=JobType.TTS,
        status=JobStatus.QUEUED,
        input_params={"text": body.text, "language": body.language},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": job.id, "status": "queued"}
