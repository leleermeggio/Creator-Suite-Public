from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Caption(Base):
    __tablename__ = "captions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    language: Mapped[str] = mapped_column(String(10), default="auto", nullable=False)
    segments: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    style_preset: Mapped[str] = mapped_column(String(50), default="default", nullable=False)
    font_family: Mapped[str] = mapped_column(String(100), default="Inter", nullable=False)
    font_size: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#FFFFFF", nullable=False)
    bg_color: Mapped[str] = mapped_column(String(20), default="rgba(0,0,0,0.7)", nullable=False)
    position: Mapped[str] = mapped_column(String(20), default="bottom", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
