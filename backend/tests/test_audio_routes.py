from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post("/auth/register", json={
        "email": "audiouser@example.com",
        "password": "StrongPass1!",
        "display_name": "Audio User",
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Audio Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_tts_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/audio/tts", json={
        "project_id": project_id,
        "text": "Hello world, this is a test.",
        "language": "en",
    }, headers=headers)
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_normalize_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/audio/normalize", json={
        "project_id": project_id,
        "asset_id": "dummy-asset",
        "target_lufs": -16.0,
    }, headers=headers)
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_extract_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/audio/extract", json={
        "project_id": project_id,
        "asset_id": "dummy-asset",
    }, headers=headers)
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_mix_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/audio/mix", json={
        "project_id": project_id,
        "track_asset_ids": ["asset-1", "asset-2"],
        "volumes": [1.0, 0.5],
    }, headers=headers)
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"
