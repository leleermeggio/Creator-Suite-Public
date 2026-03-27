from __future__ import annotations
import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_celery(monkeypatch):
    """Prevent process_job.delay from connecting to Redis in route tests."""
    with patch("backend.workers.tasks.process_job") as mock_task:
        mock_task.delay.return_value = MagicMock()
        yield


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={"email": "thumbuser@example.com", "password": "StrongPass1!", "display_name": "Thumb"},
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Thumb Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_generate_thumbnail_returns_202(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "Test Title", "template_id": "impact"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_generate_thumbnail_requires_auth(client):
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": "any", "title": "T"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_generate_thumbnail_title_required(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_thumbnail_invalid_accent_color(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "T", "accent_color": "not-a-color"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_thumbnail_wrong_project(client):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": "00000000-0000-0000-0000-000000000000", "title": "T"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_extract_frame_still_works(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/extract-frame",
        json={"project_id": project_id, "asset_id": "a1", "timestamp": 5.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_thumbnails(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "T1"},
        headers=headers,
    )
    resp = await client.get(f"/thumbnails/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
