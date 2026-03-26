from __future__ import annotations

import enum


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, enum.Enum):
    TRANSCRIBE = "transcribe"
    JUMPCUT = "jumpcut"
    EXPORT = "export"
    CAPTION = "caption"
    AUDIO_CLEANUP = "audio_cleanup"
    SMART_SEARCH = "smart_search"
    THUMBNAIL = "thumbnail"
    DOWNLOAD = "download"
    CONVERT = "convert"
    TTS = "tts"
    TRANSLATE = "translate"
