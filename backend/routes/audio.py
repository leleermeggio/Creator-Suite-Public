from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from backend.auth.dependencies import get_current_user, get_db
from backend.models.enums import JobStatus, JobType
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User

router = APIRouter(prefix="/audio", tags=["audio"])
logger = logging.getLogger(__name__)


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
    project_id: str | None = None
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

    # Validate volumes if provided
    if body.volumes is not None and len(body.volumes) != len(body.track_asset_ids):
        raise HTTPException(
            status_code=422,
            detail="Volumes list length must match track_asset_ids length",
        )

    try:
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
    except Exception as e:
        logger.error("Failed to create audio mix job: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    from backend.workers.tasks import process_job

    try:
        process_job.delay(
            job_id=str(job.id),
            job_type="audio_cleanup",
            input_params=job.input_params,
        )
    except Exception as e:
        logger.error("Failed to queue audio mix job: %s", e)
        raise HTTPException(status_code=503, detail="Task queue unavailable")

    return {"job_id": job.id, "status": "queued"}


@router.post("/normalize", status_code=status.HTTP_202_ACCEPTED)
async def normalize_audio(
    body: AudioNormalizeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Normalize audio loudness. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    # Validate target_lufs range (-25 to -7 LUFS is typical)
    if not (-25 <= body.target_lufs <= -7):
        raise HTTPException(
            status_code=422,
            detail="target_lufs must be between -25 and -7",
        )

    try:
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
    except Exception as e:
        logger.error("Failed to create audio normalize job: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    from backend.workers.tasks import process_job

    try:
        process_job.delay(
            job_id=str(job.id),
            job_type="audio_cleanup",
            input_params=job.input_params,
        )
    except Exception as e:
        logger.error("Failed to queue audio normalize job: %s", e)
        raise HTTPException(status_code=503, detail="Task queue unavailable")

    return {"job_id": job.id, "status": "queued"}


@router.post("/extract", status_code=status.HTTP_202_ACCEPTED)
async def extract_audio(
    body: AudioExtractRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract audio from video. Creates an async job."""
    await _verify_project_access(body.project_id, user, db)

    try:
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
    except Exception as e:
        logger.error("Failed to create audio extract job: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    from backend.workers.tasks import process_job

    try:
        process_job.delay(
            job_id=str(job.id),
            job_type="audio_cleanup",
            input_params=job.input_params,
        )
    except Exception as e:
        logger.error("Failed to queue audio extract job: %s", e)
        raise HTTPException(status_code=503, detail="Task queue unavailable")

    return {"job_id": job.id, "status": "queued"}


@router.post("/tts", status_code=status.HTTP_202_ACCEPTED)
async def create_tts(
    body: TTSRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate speech from text.
    - Without project_id: executes synchronously, returns MP3 file directly.
    - With project_id: creates an async job (returns job_id).
    """
    from backend.services.tts_service import text_to_speech

    # ── Standalone mode (no project required) ────────────────────────────────
    if not body.project_id:
        try:
            output_path = await text_to_speech(body.text, body.language)
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="edge-tts non installato. Contatta il supporto.",
            )
        except RuntimeError as exc:
            logger.error("TTS generation failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Text-to-speech service failed",
            ) from exc
        except Exception as exc:
            logger.error("Unexpected TTS error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc

        return FileResponse(
            path=output_path,
            media_type="audio/mpeg",
            filename=f"tts-{body.language}-{os.path.basename(output_path)}",
            background=BackgroundTask(
                lambda: os.remove(output_path) if os.path.exists(output_path) else None
            ),
        )

    # ── Project mode: async job ───────────────────────────────────────────────
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

    from backend.workers.tasks import process_job

    process_job.delay(
        job_id=str(job.id),
        job_type="tts",
        input_params=job.input_params,
    )
    return {"job_id": job.id, "status": "queued"}
