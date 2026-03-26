from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "thumbuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Thumb User",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Thumb Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_extract_frame(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/thumbnails/extract-frame",
        json={
            "project_id": project_id,
            "asset_id": "dummy-asset",
            "timestamp": 5.0,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source_type"] == "frame_extract"
    assert data["width"] == 1280
    assert data["height"] == 720


@pytest.mark.asyncio
async def test_generate_thumbnail(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/thumbnails/generate",
        json={
            "project_id": project_id,
            "prompt": "A vibrant cooking scene with pasta",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source_type"] == "ai_generated"
    assert data["prompt"] == "A vibrant cooking scene with pasta"


@pytest.mark.asyncio
async def test_list_thumbnails(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/thumbnails/extract-frame",
        json={
            "project_id": project_id,
            "asset_id": "a1",
            "timestamp": 1.0,
        },
        headers=headers,
    )
    await client.post(
        "/thumbnails/generate",
        json={
            "project_id": project_id,
            "prompt": "test prompt",
        },
        headers=headers,
    )

    resp = await client.get(f"/thumbnails/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2
