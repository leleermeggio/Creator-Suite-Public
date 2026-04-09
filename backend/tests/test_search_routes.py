from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "searchuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Search User",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/projects/",
        json={"title": "Search Test Project"},
        headers=headers,
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_search_requires_auth(client):
    resp = await client.post(
        "/search/",
        json={"project_id": "proj-123", "query": "test query"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_search_validation(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty query
    resp = await client.post(
        "/search/",
        json={"project_id": project_id, "query": "   "},
        headers=headers,
    )
    assert resp.status_code == 422

    # Query too long
    resp = await client.post(
        "/search/",
        json={"project_id": project_id, "query": "a" * 501},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_search_project_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/search/",
        json={"project_id": "nonexistent-project", "query": "test"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_search_not_owner(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create project with another user
    other_resp = await client.post(
        "/auth/register",
        json={
            "email": "searchother@example.com",
            "password": "StrongPass1!",
            "display_name": "Search Other",
        },
    )
    other_headers = {"Authorization": f"Bearer {other_resp.json()['access_token']}"}

    resp = await client.post(
        "/projects/",
        json={"title": "Other Project"},
        headers=other_headers,
    )
    project_id = resp.json()["id"]

    # First user tries to search in other's project
    resp = await client.post(
        "/search/",
        json={"project_id": project_id, "query": "test"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_search_no_transcriptions(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Search in project with no transcriptions
    resp = await client.post(
        "/search/",
        json={"project_id": project_id, "query": "test query"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_response_model(client):
    """Test that search response includes all required fields."""
    from backend.routes.search import SearchResult

    result = SearchResult(
        asset_id="test-asset",
        start=10.5,
        end=20.5,
        text="Some transcribed text",
        relevance_score=0.85,
    )

    assert result.asset_id == "test-asset"
    assert result.start == 10.5
    assert result.end == 20.5
    assert result.relevance_score == 0.85


async def _get_current_user_from_token(client, token: str):
    """Helper to get user from token."""
    import jwt

    # Get public key path from settings
    from backend.config import get_settings

    settings = get_settings()
    pub_key_path = settings.JWT_PUBLIC_KEY_PATH

    with open(pub_key_path, "rb") as f:
        public_key = f.read()

    payload = jwt.decode(token, public_key, algorithms=["RS256"])
    from backend.models.user import User

    return User(id=payload["sub"])
