from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UploadURLRequest(BaseModel):
    project_id: str
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(gt=0, le=2_147_483_648)  # 2GB max


class UploadURLResponse(BaseModel):
    upload_url: str
    storage_key: str


class RegisterAssetRequest(BaseModel):
    project_id: str
    filename: str = Field(min_length=1, max_length=255)
    storage_key: str = Field(min_length=1, max_length=512)
    mime_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(gt=0, le=2_147_483_648)
    duration_seconds: float | None = None


class ImportURLRequest(BaseModel):
    project_id: str
    url: str = Field(min_length=1, max_length=2048)


class MediaAssetResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    storage_key: str
    mime_type: str
    size_bytes: int
    duration_seconds: float | None
    download_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
