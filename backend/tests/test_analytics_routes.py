from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "analyticsuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Analytics User",
        },
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_ingest_events_requires_auth(client):
    resp = await client.post(
        "/analytics/events",
        json={"events": [{"event_type": "test_event"}]},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_ingest_events_validation(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty events array
    resp = await client.post(
        "/analytics/events",
        json={"events": []},
        headers=headers,
    )
    assert resp.status_code == 422

    # Event type too long
    resp = await client.post(
        "/analytics/events",
        json={"events": [{"event_type": "a" * 101}]},
        headers=headers,
    )
    assert resp.status_code == 422

    # Event type empty
    resp = await client.post(
        "/analytics/events",
        json={"events": [{"event_type": ""}]},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_ingest_events_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/analytics/events",
        json={
            "events": [
                {
                    "event_type": "video_uploaded",
                    "event_data": {"size_bytes": 1024},
                    "app_version": "1.0.0",
                },
                {"event_type": "project_created", "event_data": {"title": "Test"}},
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["accepted"] == 2


@pytest.mark.asyncio
async def test_ingest_events_batch_limit(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Try to send more than 100 events
    resp = await client.post(
        "/analytics/events",
        json={"events": [{"event_type": "test"} for _ in range(101)]},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_events_requires_auth(client):
    resp = await client.get("/analytics/events")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_events_returns_ingested(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest events
    await client.post(
        "/analytics/events",
        json={
            "events": [
                {"event_type": "button_clicked", "event_data": {"button": "save"}},
                {"event_type": "button_clicked", "event_data": {"button": "cancel"}},
                {"event_type": "page_viewed", "event_data": {"page": "projects"}},
            ]
        },
        headers=headers,
    )

    # List events
    resp = await client.get("/analytics/events?limit=10", headers=headers)
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 3
    # Verify all expected event types are present (order may vary for same-timestamp events)
    event_types = [e["event_type"] for e in events]
    assert "button_clicked" in event_types
    assert "page_viewed" in event_types


@pytest.mark.asyncio
async def test_list_events_respects_limit(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest 5 events
    await client.post(
        "/analytics/events",
        json={"events": [{"event_type": f"event_{i}"} for i in range(5)]},
        headers=headers,
    )

    # Request only 2
    resp = await client.get("/analytics/events?limit=2", headers=headers)
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 2


@pytest.mark.asyncio
async def test_list_events_only_own(client):
    # User A ingests events
    token_a = await _register_and_get_token(client)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    await client.post(
        "/analytics/events",
        json={"events": [{"event_type": "user_a_event"}]},
        headers=headers_a,
    )

    # User B registers and ingests events
    resp = await client.post(
        "/auth/register",
        json={
            "email": "analyticsuser2@example.com",
            "password": "StrongPass1!",
            "display_name": "Analytics User 2",
        },
    )
    token_b = resp.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    await client.post(
        "/analytics/events",
        json={"events": [{"event_type": "user_b_event"}]},
        headers=headers_b,
    )

    # User A lists events - should only see their own
    resp = await client.get("/analytics/events", headers=headers_a)
    assert resp.status_code == 200
    events = resp.json()
    event_types = [e["event_type"] for e in events]
    assert "user_a_event" in event_types
    assert "user_b_event" not in event_types

    # User B lists events - should only see their own
    resp = await client.get("/analytics/events", headers=headers_b)
    assert resp.status_code == 200
    events = resp.json()
    event_types = [e["event_type"] for e in events]
    assert "user_b_event" in event_types
    assert "user_a_event" not in event_types


@pytest.mark.asyncio
async def test_dashboard_requires_auth(client):
    resp = await client.get("/analytics/dashboard")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_empty(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/analytics/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_events"] == 0
    assert data["by_type"] == {}


@pytest.mark.asyncio
async def test_dashboard_aggregates_correctly(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest events of different types
    await client.post(
        "/analytics/events",
        json={
            "events": [
                {"event_type": "video_uploaded"},
                {"event_type": "video_uploaded"},
                {"event_type": "video_uploaded"},
                {"event_type": "project_created"},
                {"event_type": "project_created"},
                {"event_type": "caption_generated"},
            ]
        },
        headers=headers,
    )

    resp = await client.get("/analytics/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_events"] == 6
    assert data["by_type"]["video_uploaded"] == 3
    assert data["by_type"]["project_created"] == 2
    assert data["by_type"]["caption_generated"] == 1
