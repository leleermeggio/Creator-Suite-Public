from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backend.models.graphics_overlay import OverlayType


class OverlayCreate(BaseModel):
    project_id: str
    overlay_type: OverlayType
    name: str = "Untitled"
    x: float = Field(default=0.0, ge=0.0, le=1.0)
    y: float = Field(default=0.0, ge=0.0, le=1.0)
    width: float = Field(default=0.3, gt=0.0, le=1.0)
    height: float = Field(default=0.1, gt=0.0, le=1.0)
    start_time: float = Field(default=0.0, ge=0.0)
    end_time: float | None = None
    properties: dict | None = None
    asset_storage_key: str | None = None
    layer_order: int = 0


class OverlayUpdate(BaseModel):
    name: str | None = None
    x: float | None = Field(default=None, ge=0.0, le=1.0)
    y: float | None = Field(default=None, ge=0.0, le=1.0)
    width: float | None = Field(default=None, gt=0.0, le=1.0)
    height: float | None = Field(default=None, gt=0.0, le=1.0)
    start_time: float | None = Field(default=None, ge=0.0)
    end_time: float | None = None
    properties: dict | None = None
    asset_storage_key: str | None = None
    layer_order: int | None = None


class OverlayResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    overlay_type: OverlayType
    name: str
    x: float
    y: float
    width: float
    height: float
    start_time: float
    end_time: float | None
    properties: dict | None
    asset_storage_key: str | None
    layer_order: int
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
