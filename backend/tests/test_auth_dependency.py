from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    """Accessing a protected route without a token should be rejected."""
    resp = await client.get("/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_route_with_valid_token(client):
    """Accessing a protected route with a valid token should return user info."""
    reg = await client.post("/auth/register", json={
        "email": "me@example.com",
        "password": "StrongPass1!",
        "display_name": "Me User",
    })
    token = reg.json()["access_token"]

    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["display_name"] == "Me User"


@pytest.mark.asyncio
async def test_protected_route_with_invalid_token(client):
    """An invalid/malformed token should be rejected."""
    resp = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer expired.invalid.token"},
    )
    assert resp.status_code == 401
