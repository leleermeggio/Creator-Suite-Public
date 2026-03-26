from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "password": "StrongPass1!",
            "display_name": "New User",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {
        "email": "dupe@example.com",
        "password": "StrongPass1!",
        "display_name": "User",
    }
    resp1 = await client.post("/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/auth/register", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "password": "StrongPass1!",
            "display_name": "Login User",
        },
    )
    resp = await client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "StrongPass1!",
        },
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post(
        "/auth/register",
        json={
            "email": "wrong@example.com",
            "password": "StrongPass1!",
            "display_name": "User",
        },
    )
    resp = await client.post(
        "/auth/login",
        json={
            "email": "wrong@example.com",
            "password": "WrongPassword",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    resp = await client.post(
        "/auth/login",
        json={
            "email": "ghost@example.com",
            "password": "Whatever1!",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "refresh@example.com",
            "password": "StrongPass1!",
            "display_name": "Refresh User",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post(
        "/auth/refresh",
        json={
            "refresh_token": refresh_token,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_with_invalid_token(client):
    resp = await client.post(
        "/auth/refresh",
        json={
            "refresh_token": "invalid.token.here",
        },
    )
    assert resp.status_code == 401
