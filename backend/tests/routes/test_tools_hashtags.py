from __future__ import annotations

from unittest.mock import patch

import pytest

_REG_COUNTER = 0


async def _register_and_get_token(client) -> str:
    global _REG_COUNTER
    _REG_COUNTER += 1
    resp = await client.post(
        "/auth/register",
        json={
            "email": f"hashtaguser{_REG_COUNTER}@example.com",
            "password": "StrongPass1!",
            "display_name": "Hashtag Tester",
        },
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_hashtags_returns_result(client):
    """Test that /tools/hashtags returns a ToolResult when AI provider succeeds."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async def fake_call_ai(*args, **kwargs):
        return "#montagna, #drone, #vlog"

    with patch("backend.routes.tools._call_ai", side_effect=fake_call_ai):
        resp = await client.post(
            "/tools/hashtags",
            json={
                "text": "Vlog di una giornata in montagna con il drone",
                "max_count": 5,
            },
            headers=headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    assert "#montagna" in data["result"]


@pytest.mark.asyncio
async def test_hashtags_requires_auth(client):
    """Test that /tools/hashtags returns 401 without auth."""
    resp = await client.post(
        "/tools/hashtags",
        json={"text": "Test senza autenticazione"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_hashtags_validates_empty_text(client):
    """Test that /tools/hashtags rejects empty text."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/tools/hashtags",
        json={"text": "", "max_count": 5},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_hashtags_validates_max_count_range(client):
    """Test that max_count is validated (1-30)."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/tools/hashtags",
        json={"text": "Test hashtags", "max_count": 0},
        headers=headers,
    )
    assert resp.status_code == 422

    resp2 = await client.post(
        "/tools/hashtags",
        json={"text": "Test hashtags", "max_count": 31},
        headers=headers,
    )
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_hashtags_502_when_all_providers_fail(client):
    """Test that 502 is returned when all AI providers fail."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    with (
        patch(
            "backend.routes.tools._call_ai",
            side_effect=Exception("AI down"),
        ),
        patch(
            "backend.routes.tools._call_openai_compatible",
            side_effect=Exception("Fallback down"),
        ),
    ):
        resp = await client.post(
            "/tools/hashtags",
            json={"text": "Questo testo dovrebbe fallire", "max_count": 3},
            headers=headers,
        )

    assert resp.status_code == 502
    assert "unavailable" in resp.json()["detail"].lower()
