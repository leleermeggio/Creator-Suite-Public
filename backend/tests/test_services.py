from __future__ import annotations


import pytest

from backend.services.media_manager import generate_storage_key, validate_content_type


def test_validate_content_type_allowed():
    assert validate_content_type("video/mp4") is True
    assert validate_content_type("audio/mpeg") is True
    assert validate_content_type("image/jpeg") is True
    assert validate_content_type("image/png") is True


def test_validate_content_type_rejected():
    assert validate_content_type("application/x-executable") is False
    assert validate_content_type("text/html") is False
    assert validate_content_type("application/javascript") is False


def test_generate_storage_key():
    key = generate_storage_key("user-1", "proj-2", "my clip.mp4")
    assert key.startswith("media/user-1/proj-2/")
    assert "my clip.mp4" in key
    # Should contain a unique prefix
    parts = key.split("/")
    assert len(parts) == 4


def test_generate_storage_key_sanitizes_slashes():
    key = generate_storage_key("u", "p", "../../etc/passwd")
    assert ".." not in key.split("/")[-1].split("_", 1)[0]
    assert "passwd" in key


# --- Jumpcut service unit tests ---


def test_compute_keep_segments():
    from backend.services.jumpcut_service import compute_keep_segments

    silences = [
        {"start": 2.0, "end": 3.0, "duration": 1.0},
        {"start": 7.0, "end": 8.5, "duration": 1.5},
    ]
    keeps = compute_keep_segments(silences, total_duration=10.0, padding=0.0)
    assert len(keeps) == 3
    assert keeps[0] == {"start": 0.0, "end": 2.0}
    assert keeps[1] == {"start": 3.0, "end": 7.0}
    assert keeps[2] == {"start": 8.5, "end": 10.0}


def test_compute_keep_segments_no_silence():
    from backend.services.jumpcut_service import compute_keep_segments

    keeps = compute_keep_segments([], total_duration=60.0)
    assert len(keeps) == 1
    assert keeps[0] == {"start": 0.0, "end": 60.0}


# --- Exporter service unit tests ---


def test_get_preset():
    from backend.services.exporter_service import get_preset

    preset = get_preset("youtube_1080p")
    assert preset["width"] == 1920
    assert preset["height"] == 1080

    preset = get_preset("youtube_shorts")
    assert preset["width"] == 1080
    assert preset["height"] == 1920

    preset = get_preset("unknown")
    assert preset["width"] == 1920  # falls back to custom


# --- Celery task dispatch (eager mode) ---


@pytest.fixture
def celery_app():
    from backend.workers.celery_app import celery

    celery.conf.update(task_always_eager=True, task_eager_propagates=True)
    return celery


def test_process_job_unknown_type(celery_app):
    from backend.workers.tasks import process_job

    result = process_job.delay(job_id="test-1", job_type="unknown_type")
    data = result.get()
    assert data["status"] == "completed"
    assert data["job_type"] == "unknown_type"


def test_process_job_transcribe_missing_file(celery_app):
    """Transcribe with missing file should return failed status."""
    from backend.workers.tasks import process_job

    result = process_job.delay(
        job_id="test-2",
        job_type="transcribe",
        input_params={"file_path": "/nonexistent/file.wav"},
    )
    data = result.get()
    assert data["status"] == "failed"
    assert "error" in data
