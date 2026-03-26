from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post("/auth/register", json={
        "email": "mediauser@example.com",
        "password": "StrongPass1!",
        "display_name": "Media User",
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Media Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_upload_url_requires_auth(client):
    resp = await client.post("/media/upload-url", json={
        "project_id": "x", "filename": "clip.mp4",
        "content_type": "video/mp4", "size_bytes": 1000,
    })
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_url_rejects_bad_content_type(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/media/upload-url", json={
        "project_id": project_id, "filename": "evil.exe",
        "content_type": "application/x-executable", "size_bytes": 1000,
    }, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upload_url_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    with patch("backend.routes.media._get_r2") as mock_r2_factory:
        mock_r2 = MagicMock()
        mock_r2.generate_upload_url.return_value = "https://signed-upload"
        mock_r2_factory.return_value = mock_r2

        resp = await client.post("/media/upload-url", json={
            "project_id": project_id, "filename": "clip.mp4",
            "content_type": "video/mp4", "size_bytes": 5000000,
        }, headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["upload_url"] == "https://signed-upload"
    assert "storage_key" in data
    assert "clip.mp4" in data["storage_key"]


@pytest.mark.asyncio
async def test_register_and_list_assets(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Register asset
    resp = await client.post("/media/register", json={
        "project_id": project_id,
        "filename": "clip01.mp4",
        "storage_key": f"media/user/proj/{project_id}/clip01.mp4",
        "mime_type": "video/mp4",
        "size_bytes": 10_000_000,
        "duration_seconds": 120.5,
    }, headers=headers)
    assert resp.status_code == 201
    asset = resp.json()
    assert asset["filename"] == "clip01.mp4"
    assert asset["duration_seconds"] == 120.5
    asset_id = asset["id"]

    # List assets
    resp = await client.get(f"/media/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    assets = resp.json()
    assert len(assets) == 1
    assert assets[0]["id"] == asset_id


@pytest.mark.asyncio
async def test_delete_asset(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/media/register", json={
        "project_id": project_id,
        "filename": "to_delete.mp4",
        "storage_key": f"media/user/proj/{project_id}/to_delete.mp4",
        "mime_type": "video/mp4",
        "size_bytes": 5000,
    }, headers=headers)
    asset_id = resp.json()["id"]

    resp = await client.delete(f"/media/{asset_id}", headers=headers)
    assert resp.status_code == 204

    resp = await client.get(f"/media/?project_id={project_id}", headers=headers)
    assert len(resp.json()) == 0
