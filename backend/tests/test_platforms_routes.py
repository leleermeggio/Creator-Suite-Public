from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_platform_status_requires_auth(client):
    resp = await client.get("/platforms/status")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_platform_status_empty(client):
    # Register and login
    reg = await client.post(
        "/auth/register",
        json={
            "email": "plat@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.get(
        "/platforms/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "platforms" in data
    assert all(p["connected"] is False for p in data["platforms"])


@pytest.mark.asyncio
async def test_connect_unsupported_platform(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "plat2@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.post(
        "/platforms/twitch/connect",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_disconnect_not_connected(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "plat3@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.delete(
        "/platforms/youtube/disconnect",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
