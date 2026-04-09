from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "reviewuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Review User",
        },
    )
    return resp.json()["access_token"]


async def _register_reviewer(client) -> dict:
    """Register a reviewer user and return access token and user_id."""
    resp = await client.post(
        "/auth/register",
        json={
            "email": "reviewer@example.com",
            "password": "StrongPass1!",
            "display_name": "Reviewer",
        },
    )
    token = resp.json()["access_token"]
    # Get user_id from /auth/me
    me_resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    return {"access_token": token, "user_id": me_resp.json()["id"]}


async def _create_project(client, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/projects/",
        json={"title": "Review Test Project"},
        headers=headers,
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_request_review_requires_auth(client):
    resp = await client.post(
        "/reviews/",
        json={"project_id": "proj-123", "reviewer_id": "user-456"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_request_review_validation(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty project_id
    resp = await client.post(
        "/reviews/",
        json={"project_id": "", "reviewer_id": "user-456"},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_request_review_project_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)

    resp = await client.post(
        "/reviews/",
        json={
            "project_id": "nonexistent-project",
            "reviewer_id": reviewer_data["user_id"],
        },
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_request_review_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)

    resp = await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
            "notes": "Please check the intro sequence",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_id"] == project_id
    assert data["reviewer_id"] == reviewer_data["user_id"]
    assert data["status"] == "pending"
    assert data["notes"] == "Please check the intro sequence"
    return data["id"]


@pytest.mark.asyncio
async def test_list_reviews_requires_auth(client):
    resp = await client.get("/reviews/?project_id=proj-123")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_reviews_returns_added(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)

    # Create two reviews
    await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
            "notes": "First review",
        },
        headers=headers,
    )
    await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
            "notes": "Second review",
        },
        headers=headers,
    )

    # List reviews
    resp = await client.get(f"/reviews/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    reviews = resp.json()
    assert len(reviews) == 2


@pytest.mark.asyncio
async def test_respond_to_review_requires_auth(client):
    resp = await client.put(
        "/reviews/review-123",
        json={"status": "approved", "notes": "Looks good"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_respond_to_review_success(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)
    reviewer_headers = {"Authorization": f"Bearer {reviewer_data['access_token']}"}

    # Request review (as project owner)
    resp = await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
            "notes": "Please review",
        },
        headers=headers,
    )
    review_id = resp.json()["id"]

    # Respond to review (as reviewer)
    resp = await client.put(
        f"/reviews/{review_id}",
        json={"status": "approved", "notes": "Looks great!"},
        headers=reviewer_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["notes"] == "Looks great!"
    assert data["responded_at"] is not None


@pytest.mark.asyncio
async def test_respond_to_review_not_found(client):
    reviewer_data = await _register_reviewer(client)
    reviewer_headers = {"Authorization": f"Bearer {reviewer_data['access_token']}"}

    resp = await client.put(
        "/reviews/nonexistent-review",
        json={"status": "approved", "notes": "OK"},
        headers=reviewer_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_respond_to_review_wrong_reviewer(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)

    # Request review
    resp = await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
        },
        headers=headers,
    )
    review_id = resp.json()["id"]

    # Project owner tries to respond (not the reviewer)
    resp = await client.put(
        f"/reviews/{review_id}",
        json={"status": "approved", "notes": "Self-approve!"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_respond_to_review_with_rejection(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    reviewer_data = await _register_reviewer(client)
    reviewer_headers = {"Authorization": f"Bearer {reviewer_data['access_token']}"}

    # Request review
    resp = await client.post(
        "/reviews/",
        json={
            "project_id": project_id,
            "reviewer_id": reviewer_data["user_id"],
        },
        headers=headers,
    )
    review_id = resp.json()["id"]

    # Request changes (reject)
    resp = await client.put(
        f"/reviews/{review_id}",
        json={
            "status": "changes_requested",
            "notes": "Needs more work on color grading",
        },
        headers=reviewer_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "changes_requested"
