from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OverlayType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    SHAPE = "shape"
    WATERMARK = "watermark"
    LOWER_THIRD = "lower_third"
    LOGO = "logo"


class GraphicsOverlay(Base):
    __tablename__ = "graphics_overlays"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    overlay_type: Mapped[OverlayType] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="Untitled", nullable=False)
    # Position and size (normalized 0-1 relative to video frame)
    x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    width: Mapped[float] = mapped_column(Float, default=0.3, nullable=False)
    height: Mapped[float] = mapped_column(Float, default=0.1, nullable=False)
    # Timing
    start_time: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    end_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Style properties stored as JSON
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Optional asset reference (for image/logo overlays)
    asset_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    layer_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
