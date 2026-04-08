"""E2E test: create agent → create mission → start → complete steps → mission completes."""

from __future__ import annotations

import pytest


async def _register(client, email: str) -> str:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "password": "StrongPass1!", "display_name": "tester"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "E2E Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def _create_agent(client, token: str) -> str:
    resp = await client.post(
        "/agents/",
        json={
            "name": "E2E Agent",
            "icon": "🧪",
            "description": "E2E pipeline test",
            "steps": [
                {
                    "tool_id": "summarize",
                    "label": "Riassumi",
                    "parameters": {"text": "Test text for summarization."},
                    "auto_run": True,
                    "required": True,
                    "condition": None,
                },
                {
                    "tool_id": "translate",
                    "label": "Traduci",
                    "parameters": {"text": "Summary result", "target_language": "en"},
                    "auto_run": True,
                    "required": True,
                    "condition": None,
                },
            ],
            "default_mode": "REGISTA",
            "target_platforms": ["youtube"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_mission_complete_step_route(client):
    """POST /missions/{id}/steps/{idx}/complete marks step done and advances."""
    token = await _register(client, "e2e_complete@example.com")
    project_id = await _create_project(client, token)
    agent_id = await _create_agent(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create mission
    resp = await client.post(
        "/missions/",
        json={"agent_id": agent_id, "project_id": project_id, "mode": "REGISTA"},
        headers=headers,
    )
    assert resp.status_code == 201
    mission_id = resp.json()["id"]

    # Start mission
    resp = await client.post(f"/missions/{mission_id}/start", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "RUNNING"

    # Complete step 0 with output
    resp = await client.post(
        f"/missions/{mission_id}/steps/0/complete",
        json={"output": {"summary": "test summary"}},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    step_results = data["step_results"]
    assert any(
        s["step_index"] == 0 and s["status"] == "COMPLETED" for s in step_results
    )


@pytest.mark.asyncio
async def test_full_mission_lifecycle(client):
    """Full lifecycle: create → start → complete all steps → mission COMPLETED."""
    token = await _register(client, "e2e_lifecycle@example.com")
    project_id = await _create_project(client, token)
    agent_id = await _create_agent(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/missions/",
        json={"agent_id": agent_id, "project_id": project_id, "mode": "REGISTA"},
        headers=headers,
    )
    mission_id = resp.json()["id"]

    # Start
    await client.post(f"/missions/{mission_id}/start", headers=headers)

    # Complete step 0
    resp = await client.post(
        f"/missions/{mission_id}/steps/0/complete",
        json={"output": {"summary": "done"}},
        headers=headers,
    )
    assert resp.status_code == 200

    # Complete step 1 (last step)
    resp = await client.post(
        f"/missions/{mission_id}/steps/1/complete",
        json={"output": {"translated_text": "done in english"}},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_complete_step_without_auth(client):
    """401 when no auth header."""
    resp = await client.post("/missions/fake-id/steps/0/complete", json={"output": {}})
    assert resp.status_code == 401
