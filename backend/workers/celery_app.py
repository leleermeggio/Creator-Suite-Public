from __future__ import annotations

import os

from celery import Celery

# Read directly from env (not Settings) because Celery initializes before FastAPI
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "creator_suite",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["backend.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,  # 30 min max per job
    worker_prefetch_multiplier=1,
    worker_concurrency=2,
)
