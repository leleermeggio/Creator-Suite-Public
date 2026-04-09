"""Tests for PUT /auth/me and POST /auth/avatar."""

from __future__ import annotations

import pytest


async def _register(client, email: str, display_name: str = "Test User") -> str:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "password": "StrongPass1!", "display_name": display_name},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


# ── PUT /auth/me ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_me_display_name(client):
    token = await _register(client, "update@test.com", "Old Name")
    resp = await client.put(
        "/auth/me",
        json={"display_name": "New Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "New Name"
    assert "avatar_url" in data
    assert data["avatar_url"] is None

    # Verify persistence
    resp2 = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 200
    assert resp2.json()["display_name"] == "New Name"


@pytest.mark.asyncio
async def test_update_me_requires_auth(client):
    resp = await client.put("/auth/me", json={"display_name": "Name"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me_empty_name_rejected(client):
    token = await _register(client, "empty@test.com")
    resp = await client.put(
        "/auth/me",
        json={"display_name": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_me_name_too_long_rejected(client):
    token = await _register(client, "long@test.com")
    resp = await client.put(
        "/auth/me",
        json={"display_name": "A" * 65},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_me_empty_body_is_noop(client):
    token = await _register(client, "noop@test.com", "Unchanged")
    resp = await client.put(
        "/auth/me",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Unchanged"


# ── POST /auth/avatar ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_avatar_jpeg(client):
    token = await _register(client, "avatar@test.com", "Avatar User")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["avatar_url"] is not None
    assert data["avatar_url"].startswith("/static/avatars/")
    assert data["avatar_url"].endswith(".jpg")


@pytest.mark.asyncio
async def test_upload_avatar_png(client):
    token = await _register(client, "avatarpng@test.com", "PNG User")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.png", b"\x89PNG\r\n" + b"\x00" * 20, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["avatar_url"].endswith(".png")


@pytest.mark.asyncio
async def test_upload_avatar_wrong_type_rejected(client):
    token = await _register(client, "wrongtype@test.com")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("file.txt", b"text content", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_avatar_too_large_rejected(client):
    token = await _register(client, "toolarge@test.com")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("big.jpg", b"\xff" * (6 * 1024 * 1024), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_upload_avatar_requires_auth(client):
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_returns_avatar_url(client):
    token = await _register(client, "mecheck@test.com", "Check User")
    await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is not None
