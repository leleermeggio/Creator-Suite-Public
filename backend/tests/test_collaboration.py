from __future__ import annotations

import pytest


async def _register(client, email: str) -> str:
    resp = await client.post("/auth/register", json={
        "email": email, "password": "StrongPass1!", "display_name": email.split("@")[0],
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/", json={"title": "Collab Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


# --- Teams ---

@pytest.mark.asyncio
async def test_create_team(client):
    token = await _register(client, "teamowner@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/teams/", json={"name": "My Team"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Team"


@pytest.mark.asyncio
async def test_list_teams(client):
    token = await _register(client, "teamlister@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/teams/", json={"name": "Team A"}, headers=headers)
    await client.post("/teams/", json={"name": "Team B"}, headers=headers)

    resp = await client.get("/teams/", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_list_team_members(client):
    token = await _register(client, "memberlist@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/teams/", json={"name": "Members Team"}, headers=headers)
    team_id = resp.json()["id"]

    resp = await client.get(f"/teams/{team_id}/members", headers=headers)
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"


# --- Comments ---

@pytest.mark.asyncio
async def test_add_comment(client):
    token = await _register(client, "commenter@example.com")
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(f"/projects/{project_id}/comments/", json={
        "text": "Great intro!",
        "timeline_timestamp": 5.0,
    }, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Great intro!"
    assert data["timeline_timestamp"] == 5.0
    assert data["resolved"] is False


@pytest.mark.asyncio
async def test_list_comments(client):
    token = await _register(client, "commentlister@example.com")
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(f"/projects/{project_id}/comments/", json={"text": "Comment 1"}, headers=headers)
    await client.post(f"/projects/{project_id}/comments/", json={"text": "Comment 2"}, headers=headers)

    resp = await client.get(f"/projects/{project_id}/comments/", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_resolve_comment(client):
    token = await _register(client, "resolver@example.com")
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(f"/projects/{project_id}/comments/", json={"text": "Fix this"}, headers=headers)
    comment_id = resp.json()["id"]

    resp = await client.put(f"/projects/{project_id}/comments/{comment_id}/resolve", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["resolved"] is True


@pytest.mark.asyncio
async def test_update_comment(client):
    token = await _register(client, "editor@example.com")
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(f"/projects/{project_id}/comments/", json={"text": "Original"}, headers=headers)
    comment_id = resp.json()["id"]

    resp = await client.put(f"/projects/{project_id}/comments/{comment_id}", json={"text": "Updated"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["text"] == "Updated"
