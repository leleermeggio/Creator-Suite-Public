from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.models.enums import JobStatus, JobType


class JobCreate(BaseModel):
    project_id: str
    type: JobType
    input_params: dict | None = None


class JobResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    type: JobType
    status: JobStatus
    progress: int
    input_params: dict | None
    result: dict | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
