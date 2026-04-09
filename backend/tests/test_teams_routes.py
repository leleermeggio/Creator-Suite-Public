from __future__ import annotations

import pytest
import uuid


async def _register_and_get_token(client) -> str:
    unique_id = uuid.uuid4().hex[:8]
    resp = await client.post(
        "/auth/register",
        json={
            "email": f"teamuser_{unique_id}@example.com",
            "password": "StrongPass1!",
            "display_name": "Team User",
        },
    )
    return resp.json()["access_token"]


async def _register_second_user(client) -> dict:
    """Register a second user for team membership tests."""
    unique_id = uuid.uuid4().hex[:8]
    resp = await client.post(
        "/auth/register",
        json={
            "email": f"teammember_{unique_id}@example.com",
            "password": "StrongPass1!",
            "display_name": "Team Member",
        },
    )
    token = resp.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    return {
        "access_token": token,
        "user_id": me.json()["id"],
    }


@pytest.mark.asyncio
async def test_create_team_requires_auth(client):
    resp = await client.post(
        "/teams/",
        json={"name": "My Team"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_team_validation(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty name
    resp = await client.post(
        "/teams/",
        json={"name": "   "},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_team_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Marketing Team"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Marketing Team"
    assert "id" in data
    return data["id"]


@pytest.mark.asyncio
async def test_list_teams_requires_auth(client):
    resp = await client.get("/teams/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_teams_returns_created(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a team inline for this test
    resp = await client.post(
        "/teams/",
        json={"name": "Test Team for List"},
        headers=headers,
    )
    assert resp.status_code == 201
    team_id = resp.json()["id"]

    # Now list teams and verify our team is there
    resp = await client.get("/teams/", headers=headers)
    assert resp.status_code == 200
    teams = resp.json()
    assert len(teams) >= 1
    team_ids = [t["id"] for t in teams]
    assert team_id in team_ids


@pytest.mark.asyncio
async def test_get_team_requires_auth(client):
    resp = await client.get("/teams/nonexistent")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_team_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/teams/nonexistent-id", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_member_requires_auth(client):
    resp = await client.post(
        "/teams/team-123/members",
        json={"user_id": "user-456", "role": "viewer"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_add_member_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create team
    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    # Register second user
    member_data = await _register_second_user(client)

    # Add member
    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == member_data["user_id"]
    assert data["role"] == "viewer"


@pytest.mark.asyncio
async def test_add_member_already_exists(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    member_data = await _register_second_user(client)

    # Add same member twice
    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )

    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_member_role(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    member_data = await _register_second_user(client)

    # Add member as viewer
    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )

    # Update to editor
    resp = await client.put(
        f"/teams/{team_id}/members/{member_data['user_id']}",
        json={"role": "editor"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "editor"


@pytest.mark.asyncio
async def test_update_member_role_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.put(
        "/teams/nonexistent/members/user-123",
        json={"role": "editor"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_member(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    member_data = await _register_second_user(client)

    # Add member
    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )

    # Remove member
    resp = await client.delete(
        f"/teams/{team_id}/members/{member_data['user_id']}",
        headers=headers,
    )
    assert resp.status_code == 204

    # Verify removed
    resp = await client.get(f"/teams/{team_id}/members", headers=headers)
    members = resp.json()
    member_ids = [m["user_id"] for m in members]
    assert member_data["user_id"] not in member_ids


@pytest.mark.asyncio
async def test_remove_owner_fails(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    # Get owner's user_id
    me = await client.get("/auth/me", headers=headers)
    owner_id = me.json()["id"]

    # Try to remove owner (themselves) — should be blocked
    resp = await client.delete(f"/teams/{team_id}/members/{owner_id}", headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_members(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Test Team"},
        headers=headers,
    )
    team_id = resp.json()["id"]

    member_data = await _register_second_user(client)

    # Add member
    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_data["user_id"], "role": "viewer"},
        headers=headers,
    )

    # List members (should include owner + added member)
    resp = await client.get(f"/teams/{team_id}/members", headers=headers)
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 2


@pytest.mark.asyncio
async def test_list_members_not_in_team(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create team with another user
    other_token = (await _register_second_user(client))["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    resp = await client.post(
        "/teams/",
        json={"name": "Other Team"},
        headers=other_headers,
    )
    team_id = resp.json()["id"]

    # First user tries to access team they're not in
    resp = await client.get(f"/teams/{team_id}/members", headers=headers)
    assert resp.status_code == 404
