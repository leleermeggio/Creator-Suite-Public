from __future__ import annotations

import pytest


@pytest.fixture
def celery_app():
    from backend.workers.celery_app import celery
    celery.conf.update(task_always_eager=True, task_eager_propagates=True)
    return celery


def test_ping_task(celery_app):
    from backend.workers.tasks import ping
    result = ping.delay()
    assert result.get() == "pong"


def test_process_job_task(celery_app):
    from backend.workers.tasks import process_job
    # Use a generic type that doesn't require external deps (whisper, ffmpeg, etc.)
    result = process_job.delay(job_id="test-job-123", job_type="unknown_stub")
    data = result.get()
    assert data["job_id"] == "test-job-123"
    assert data["status"] == "completed"
