from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "exportuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Export User",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Export Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_export(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/exports/",
        json={
            "project_id": project_id,
            "format_preset": "youtube_1080p",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["format_preset"] == "youtube_1080p"
    assert data["status"] == "queued"
    assert data["resolution"] == "1920x1080"
    assert data["progress"] == 0


@pytest.mark.asyncio
async def test_list_exports(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/exports/",
        json={
            "project_id": project_id,
            "format_preset": "youtube_1080p",
        },
        headers=headers,
    )
    await client.post(
        "/exports/",
        json={
            "project_id": project_id,
            "format_preset": "youtube_shorts",
            "aspect_ratio": "9:16",
            "resolution": "1080x1920",
        },
        headers=headers,
    )

    resp = await client.get(f"/exports/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    exports = resp.json()
    assert len(exports) == 2


@pytest.mark.asyncio
async def test_get_export(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/exports/",
        json={
            "project_id": project_id,
            "format_preset": "tiktok",
            "aspect_ratio": "9:16",
            "resolution": "1080x1920",
        },
        headers=headers,
    )
    export_id = resp.json()["id"]

    resp = await client.get(f"/exports/{export_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["format_preset"] == "tiktok"
