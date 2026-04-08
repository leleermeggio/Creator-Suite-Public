from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ExportFormat(str, enum.Enum):
    YOUTUBE_1080P = "youtube_1080p"
    YOUTUBE_SHORTS = "youtube_shorts"
    TIKTOK = "tiktok"
    INSTAGRAM_REEL = "instagram_reel"
    CUSTOM = "custom"


class ExportStatus(str, enum.Enum):
    QUEUED = "queued"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class Export(Base):
    __tablename__ = "exports"

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
    format_preset: Mapped[ExportFormat] = mapped_column(nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(
        String(20), default="16:9", nullable=False
    )
    resolution: Mapped[str] = mapped_column(
        String(20), default="1920x1080", nullable=False
    )
    codec: Mapped[str] = mapped_column(String(50), default="h264", nullable=False)
    status: Mapped[ExportStatus] = mapped_column(
        default=ExportStatus.QUEUED, nullable=False
    )
    output_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
