from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ThumbnailSource(str, enum.Enum):
    FRAME_EXTRACT = "frame_extract"
    AI_GENERATED = "ai_generated"
    UPLOADED = "uploaded"


class Thumbnail(Base):
    __tablename__ = "thumbnails"

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
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_type: Mapped[ThumbnailSource] = mapped_column(
        default=ThumbnailSource.FRAME_EXTRACT, nullable=False
    )
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    width: Mapped[int] = mapped_column(Integer, default=1280, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=720, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
