from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.models.export import ExportFormat, ExportStatus


class ExportCreate(BaseModel):
    project_id: str
    format_preset: ExportFormat
    aspect_ratio: str = "16:9"
    resolution: str = "1920x1080"
    codec: str = "h264"


class ExportResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    format_preset: ExportFormat
    aspect_ratio: str
    resolution: str
    codec: str
    status: ExportStatus
    output_storage_key: str | None
    file_size_bytes: int | None
    progress: int
    error: str | None
    download_url: str | None = None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
