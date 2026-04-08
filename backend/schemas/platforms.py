from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PlatformConnectResponse(BaseModel):
    auth_url: str


class PlatformStatusItem(BaseModel):
    platform: str
    connected: bool
    username: str | None = None
    connected_at: datetime | None = None
    last_synced_at: datetime | None = None


class PlatformStatusResponse(BaseModel):
    platforms: list[PlatformStatusItem]
