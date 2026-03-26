from __future__ import annotations

import uuid

ALLOWED_MEDIA_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-matroska",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/x-wav",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


def validate_content_type(content_type: str) -> bool:
    return content_type.lower() in ALLOWED_MEDIA_TYPES


def generate_storage_key(user_id: str, project_id: str, filename: str) -> str:
    unique = uuid.uuid4().hex[:8]
    safe_name = filename.replace("/", "_").replace("\\", "_")
    return f"media/{user_id}/{project_id}/{unique}_{safe_name}"
