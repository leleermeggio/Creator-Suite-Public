from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backend.models.thumbnail import ThumbnailSource


class ThumbnailExtractRequest(BaseModel):
    project_id: str
    asset_id: str
    timestamp: float = Field(
        ge=0.0, description="Timestamp in seconds to extract frame"
    )


class ThumbnailGenerateRequest(BaseModel):
    project_id: str
    prompt: str = Field(min_length=1, max_length=1000)


class ThumbnailResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    storage_key: str | None
    source_type: ThumbnailSource
    prompt: str | None
    width: int
    height: int
    download_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
