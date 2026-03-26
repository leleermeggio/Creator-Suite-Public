from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post("/auth/register", json={
        "email": "jobuser@example.com",
        "password": "StrongPass1!",
        "display_name": "Job User",
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects",
        json={"title": "Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_job_requires_auth(client):
    resp = await client.post("/jobs", json={"project_id": "x", "type": "transcribe"})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_and_get_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create job
    resp = await client.post("/jobs", json={
        "project_id": project_id,
        "type": "transcribe",
        "input_params": {"language": "it"},
    }, headers=headers)
    assert resp.status_code == 201
    job = resp.json()
    assert job["type"] == "transcribe"
    assert job["status"] == "queued"
    assert job["progress"] == 0
    job_id = job["id"]

    # Get job
    resp = await client.get(f"/jobs/{job_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == job_id


@pytest.mark.asyncio
async def test_list_jobs_for_project(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/jobs", json={
        "project_id": project_id, "type": "transcribe",
    }, headers=headers)
    await client.post("/jobs", json={
        "project_id": project_id, "type": "jumpcut",
    }, headers=headers)

    resp = await client.get(f"/jobs?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) == 2
