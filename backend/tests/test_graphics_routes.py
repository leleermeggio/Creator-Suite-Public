from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post("/auth/register", json={
        "email": "gfxuser@example.com",
        "password": "StrongPass1!",
        "display_name": "GFX User",
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "GFX Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_overlay(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/overlays/", json={
        "project_id": project_id,
        "overlay_type": "text",
        "name": "Title Card",
        "x": 0.1,
        "y": 0.1,
        "width": 0.8,
        "height": 0.2,
        "start_time": 0.0,
        "end_time": 5.0,
        "properties": {"text": "Welcome!", "font_size": 48, "color": "#FFFFFF"},
    }, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["overlay_type"] == "text"
    assert data["name"] == "Title Card"
    assert data["properties"]["text"] == "Welcome!"


@pytest.mark.asyncio
async def test_list_overlays(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/overlays/", json={
        "project_id": project_id, "overlay_type": "text", "name": "Overlay 1",
    }, headers=headers)
    await client.post("/overlays/", json={
        "project_id": project_id, "overlay_type": "watermark", "name": "Overlay 2",
        "layer_order": 1,
    }, headers=headers)

    resp = await client.get(f"/overlays/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    overlays = resp.json()
    assert len(overlays) == 2
    # Should be ordered by layer_order
    assert overlays[0]["layer_order"] <= overlays[1]["layer_order"]


@pytest.mark.asyncio
async def test_update_overlay(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/overlays/", json={
        "project_id": project_id, "overlay_type": "image", "name": "Logo",
    }, headers=headers)
    overlay_id = resp.json()["id"]

    resp = await client.put(f"/overlays/{overlay_id}", json={
        "name": "Updated Logo",
        "x": 0.8,
        "y": 0.05,
        "width": 0.15,
        "height": 0.08,
    }, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Logo"
    assert data["x"] == 0.8


@pytest.mark.asyncio
async def test_delete_overlay(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/overlays/", json={
        "project_id": project_id, "overlay_type": "shape", "name": "Box",
    }, headers=headers)
    overlay_id = resp.json()["id"]

    resp = await client.delete(f"/overlays/{overlay_id}", headers=headers)
    assert resp.status_code == 204

    resp = await client.get(f"/overlays/?project_id={project_id}", headers=headers)
    assert len(resp.json()) == 0
