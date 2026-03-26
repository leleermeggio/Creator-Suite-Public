from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "captionuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Caption User",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Caption Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_generate_caption(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/captions/generate",
        json={
            "project_id": project_id,
            "language": "it",
            "style_preset": "bold_center",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["language"] == "it"
    assert data["style_preset"] == "bold_center"


@pytest.mark.asyncio
async def test_list_and_get_caption(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/captions/generate",
        json={
            "project_id": project_id,
        },
        headers=headers,
    )
    caption_id = resp.json()["id"]

    # List
    resp = await client.get(f"/captions/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Get
    resp = await client.get(f"/captions/{caption_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == caption_id


@pytest.mark.asyncio
async def test_update_caption(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/captions/generate",
        json={
            "project_id": project_id,
        },
        headers=headers,
    )
    caption_id = resp.json()["id"]

    resp = await client.put(
        f"/captions/{caption_id}",
        json={
            "font_size": 32,
            "color": "#FF0000",
            "position": "top",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["font_size"] == 32
    assert data["color"] == "#FF0000"
    assert data["position"] == "top"


@pytest.mark.asyncio
async def test_translate_caption(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/captions/generate",
        json={
            "project_id": project_id,
            "language": "it",
        },
        headers=headers,
    )
    caption_id = resp.json()["id"]

    resp = await client.post(
        f"/captions/{caption_id}/translate",
        json={
            "target_language": "en",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["language"] == "en"
    assert data["id"] != caption_id
