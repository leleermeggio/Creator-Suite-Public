from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_overview_requires_auth(client):
    resp = await client.get("/creator-analytics/overview")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_overview_empty(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "ana@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.get(
        "/creator-analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "month"
    assert data["platforms"] == {}


@pytest.mark.asyncio
async def test_performance_requires_auth(client):
    resp = await client.get("/creator-analytics/performance")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_calendar_requires_auth(client):
    resp = await client.get("/creator-analytics/calendar?month=2026-04")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_calendar_invalid_month(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "cal@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.get(
        "/creator-analytics/calendar?month=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_sync_no_platforms(client):
    reg = await client.post(
        "/auth/register",
        json={
            "email": "sync@test.com",
            "password": "StrongPass1!",
            "display_name": "Tester",
        },
    )
    token = reg.json()["access_token"]

    resp = await client.post(
        "/creator-analytics/sync",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
