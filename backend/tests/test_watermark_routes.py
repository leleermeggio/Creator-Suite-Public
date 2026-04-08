from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "wmuser@example.com",
            "password": "StrongPass1!",
            "display_name": "WM User",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Watermark Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_image_watermark_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/watermark/image",
        json={
            "project_id": project_id,
            "asset_id": "dummy-asset",
            "watermark_storage_key": "media/wm/logo.png",
            "position": "bottom_right",
            "opacity": 0.3,
            "scale": 0.1,
        },
        headers=headers,
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_text_watermark_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/watermark/text",
        json={
            "project_id": project_id,
            "asset_id": "dummy-asset",
            "text": "© My Channel 2026",
            "position": "top_right",
            "font_size": 18,
            "color": "white",
            "opacity": 0.4,
        },
        headers=headers,
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_burn_in_captions_creates_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a caption first
    resp = await client.post(
        "/captions/generate",
        json={
            "project_id": project_id,
            "language": "en",
            "style_preset": "youtube",
        },
        headers=headers,
    )
    caption_id = resp.json()["id"]

    # Burn-in
    resp = await client.post(f"/captions/{caption_id}/burn-in", headers=headers)
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"
