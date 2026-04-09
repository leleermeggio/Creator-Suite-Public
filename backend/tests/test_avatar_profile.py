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
