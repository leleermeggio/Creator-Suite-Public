from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "commentuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Comment User",
        },
    )
    return resp.json()["access_token"]


async def _register_second_user(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "commentuser2@example.com",
            "password": "StrongPass1!",
            "display_name": "Comment User 2",
        },
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/projects/",
        json={"title": "Comment Test Project"},
        headers=headers,
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_add_comment_requires_auth(client):
    resp = await client.post(
        "/projects/proj-123/comments/",
        json={"text": "Test comment", "timeline_timestamp": 0},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_add_comment_validation(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty text
    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "   ", "timeline_timestamp": 0},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_comment_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={
            "text": "Review this section at 30 seconds",
            "timeline_timestamp": 30.5,
            "asset_id": "asset-123",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Review this section at 30 seconds"
    assert data["timeline_timestamp"] == 30.5
    assert data["resolved"] is False
    return data["id"]


@pytest.mark.asyncio
async def test_add_comment_not_owner(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create project with another user
    other_resp = await client.post(
        "/auth/register",
        json={
            "email": "commentuser2@example.com",
            "password": "StrongPass1!",
            "display_name": "Comment User 2",
        },
    )
    other_token = other_resp.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    resp = await client.post(
        "/projects/",
        json={"title": "Other Project"},
        headers=other_headers,
    )
    project_id = resp.json()["id"]

    # First user CAN add comment to other's project (collaborative commenting)
    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "Collaborative comment", "timeline_timestamp": 0},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Collaborative comment"
    # Comment was created successfully (collaborative commenting enabled)
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_list_comments_requires_auth(client):
    resp = await client.get("/projects/proj-123/comments/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_comments_returns_added(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Add two comments
    await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "First comment", "timeline_timestamp": 10},
        headers=headers,
    )
    await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "Second comment", "timeline_timestamp": 20},
        headers=headers,
    )

    # List comments
    resp = await client.get(f"/projects/{project_id}/comments/", headers=headers)
    assert resp.status_code == 200
    comments = resp.json()
    assert len(comments) == 2
    assert comments[0]["text"] == "First comment"
    assert comments[1]["text"] == "Second comment"


@pytest.mark.asyncio
async def test_update_comment_requires_auth(client):
    resp = await client.put(
        "/projects/proj-123/comments/comment-456",
        json={"text": "Updated"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_update_comment_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Add comment
    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "Original text", "timeline_timestamp": 0},
        headers=headers,
    )
    comment_id = resp.json()["id"]

    # Update comment
    resp = await client.put(
        f"/projects/{project_id}/comments/{comment_id}",
        json={"text": "Updated text"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["text"] == "Updated text"


@pytest.mark.asyncio
async def test_update_comment_not_found(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.put(
        f"/projects/{project_id}/comments/nonexistent",
        json={"text": "Updated"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_comment_cannot_edit_others(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create comment with another user
    other_data = await _register_second_user(client)
    other_headers = {"Authorization": f"Bearer {other_data['access_token']}"}

    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "Other user comment", "timeline_timestamp": 0},
        headers=other_headers,
    )
    comment_id = resp.json()["id"]

    # First user tries to update other's comment
    resp = await client.put(
        f"/projects/{project_id}/comments/{comment_id}",
        json={"text": "Hacked!"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resolve_comment_requires_auth(client):
    resp = await client.put("/projects/proj-123/comments/comment-456/resolve")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_resolve_comment_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Add comment
    resp = await client.post(
        f"/projects/{project_id}/comments/",
        json={"text": "Issue to resolve", "timeline_timestamp": 0},
        headers=headers,
    )
    comment_id = resp.json()["id"]

    # Resolve comment
    resp = await client.put(
        f"/projects/{project_id}/comments/{comment_id}/resolve",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["resolved"] is True


@pytest.mark.asyncio
async def test_resolve_comment_not_found(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.put(
        f"/projects/{project_id}/comments/nonexistent/resolve",
        headers=headers,
    )
    assert resp.status_code == 404


async def _register_second_user(client) -> dict:
    """Register a second user for multi-user tests."""
    resp = await client.post(
        "/auth/register",
        json={
            "email": "commentmember@example.com",
            "password": "StrongPass1!",
            "display_name": "Comment Member",
        },
    )
    return resp.json()
