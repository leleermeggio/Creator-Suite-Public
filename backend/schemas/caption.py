from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CaptionCreate(BaseModel):
    project_id: str
    asset_id: str | None = None
    language: str = "auto"
    style_preset: str = "default"
    segments: list[dict[str, Any]] | dict[str, Any] | None = None


class CaptionUpdate(BaseModel):
    segments: list[dict[str, Any]] | dict[str, Any] | None = None
    language: str | None = None
    style_preset: str | None = None
    font_family: str | None = None
    font_size: int | None = None
    color: str | None = None
    bg_color: str | None = None
    position: str | None = None


class CaptionResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    asset_id: str | None
    language: str
    segments: list[dict[str, Any]] | dict[str, Any] | None
    style_preset: str
    font_family: str
    font_size: int
    color: str
    bg_color: str
    position: str
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class TranslateRequest(BaseModel):
    target_language: str = Field(min_length=2, max_length=10)
