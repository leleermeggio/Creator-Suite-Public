from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": "agentuser@example.com",
            "password": "StrongPass1!",
            "display_name": "Agent User",
        },
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_generate_agent_requires_auth(client):
    resp = await client.post(
        "/agents/generate",
        json={"description": "A video summarizer agent"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_generate_agent_validation(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Empty description
    resp = await client.post(
        "/agents/generate",
        json={"description": "   "},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_agent_success(client):
    from datetime import datetime
    from unittest.mock import patch

    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    mock_agent = {
        "id": "mock-agent-id",
        "user_id": None,
        "name": "Generated Agent",
        "icon": "🤖",
        "description": "A video summarizer agent",
        "steps": [],
        "default_mode": "COPILOTA",
        "target_platforms": [],
        "is_preset": False,
        "preset_id": None,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }

    # Mock the service function where it's actually defined
    with patch(
        "backend.services.agent_service.generate_agent_from_description",
        return_value=mock_agent,
    ):
        resp = await client.post(
            "/agents/generate",
            json={"description": "Create a video summarizer that extracts key moments"},
            headers=headers,
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "mock-agent-id"
    assert data["name"] == "Generated Agent"


@pytest.mark.asyncio
async def test_generate_agent_gemini_error(client):
    from unittest.mock import MagicMock, patch

    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    mock_func = MagicMock(side_effect=ValueError("Gemini API error"))
    with patch(
        "backend.services.agent_service.generate_agent_from_description", new=mock_func
    ):
        resp = await client.post(
            "/agents/generate",
            json={"description": "Create a test agent for validation purposes"},
            headers=headers,
        )

    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_create_agent_requires_auth(client):
    resp = await client.post(
        "/agents/",
        json={
            "name": "My Agent",
            "icon": "🤖",
            "description": "Test agent",
            "steps": [],
        },
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_agent_validation(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Missing name
    resp = await client.post(
        "/agents/",
        json={
            "icon": "🤖",
            "description": "Test agent",
            "steps": [],
        },
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_agent_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/agents/",
        json={
            "name": "YouTube Summarizer",
            "icon": "📹",
            "description": "Summarizes YouTube videos",
            "steps": [
                {
                    "tool_id": "summarize",
                    "label": "Summarize video",
                    "parameters": {},
                }
            ],
            "default_mode": "COPILOTA",
            "target_platforms": ["youtube"],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "YouTube Summarizer"
    assert data["icon"] == "📹"
    assert data["is_preset"] is False
    return data["id"]


@pytest.mark.asyncio
async def test_list_agents_requires_auth(client):
    resp = await client.get("/agents/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_agents_returns_own_and_presets(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create an agent
    await client.post(
        "/agents/",
        json={
            "name": "YouTube Summarizer",
            "icon": "📹",
            "description": "Summarizes YouTube videos",
            "steps": [
                {"tool_id": "summarize", "label": "Summarize video", "parameters": {}}
            ],
            "default_mode": "COPILOTA",
            "target_platforms": ["youtube"],
        },
        headers=headers,
    )

    resp = await client.get("/agents/", headers=headers)
    assert resp.status_code == 200
    agents = resp.json()
    # Should include at least the created agent + any presets
    assert len(agents) >= 1
    agent_names = [a["name"] for a in agents]
    assert "YouTube Summarizer" in agent_names


@pytest.mark.asyncio
async def test_list_preset_agents_requires_auth(client):
    resp = await client.get("/agents/presets")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_preset_agents_only_presets(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a non-preset agent
    await client.post(
        "/agents/",
        json={
            "name": "My Custom Agent",
            "icon": "🤖",
            "description": "Custom",
            "steps": [],
        },
        headers=headers,
    )

    resp = await client.get("/agents/presets", headers=headers)
    assert resp.status_code == 200
    agents = resp.json()
    # Should only include presets, not custom agents
    for agent in agents:
        assert agent["is_preset"] is True


@pytest.mark.asyncio
async def test_get_agent_requires_auth(client):
    resp = await client.get("/agents/agent-123")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_agent_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/agents/nonexistent-id", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_agent_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create agent
    resp = await client.post(
        "/agents/",
        json={
            "name": "Get Test Agent",
            "icon": "🔍",
            "description": "For testing get endpoint",
            "steps": [],
        },
        headers=headers,
    )
    agent_id = resp.json()["id"]

    # Get agent
    resp = await client.get(f"/agents/{agent_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == agent_id
    assert data["name"] == "Get Test Agent"


@pytest.mark.asyncio
async def test_update_agent_requires_auth(client):
    resp = await client.put(
        "/agents/agent-123",
        json={"name": "Updated Name"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_update_agent_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.put(
        "/agents/nonexistent-id",
        json={"name": "Updated Name"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_agent_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create agent
    resp = await client.post(
        "/agents/",
        json={
            "name": "Original Name",
            "icon": "🤖",
            "description": "Original description",
            "steps": [],
        },
        headers=headers,
    )
    agent_id = resp.json()["id"]

    # Update agent
    resp = await client.put(
        f"/agents/{agent_id}",
        json={"name": "Updated Name", "description": "Updated description"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_preset_agent_fails(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Find a preset agent
    resp = await client.get("/agents/presets", headers=headers)
    presets = resp.json()

    if presets:
        preset_id = presets[0]["id"]
        resp = await client.put(
            f"/agents/{preset_id}",
            json={"name": "Hacked Preset"},
            headers=headers,
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_agent_requires_auth(client):
    resp = await client.delete("/agents/agent-123")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_agent_not_found(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.delete("/agents/nonexistent-id", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_agent_success(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create agent
    resp = await client.post(
        "/agents/",
        json={
            "name": "To Delete",
            "icon": "🗑️",
            "description": "Will be deleted",
            "steps": [],
        },
        headers=headers,
    )
    agent_id = resp.json()["id"]

    # Delete agent
    resp = await client.delete(f"/agents/{agent_id}", headers=headers)
    assert resp.status_code == 204

    # Verify deleted
    resp = await client.get(f"/agents/{agent_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_preset_agent_fails(client):
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Find a preset agent
    resp = await client.get("/agents/presets", headers=headers)
    presets = resp.json()

    if presets:
        preset_id = presets[0]["id"]
        resp = await client.delete(f"/agents/{preset_id}", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_access_other_users_agent(client):
    # User A creates agent
    token_a = await _register_and_get_token(client)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp = await client.post(
        "/agents/",
        json={
            "name": "User A Agent",
            "icon": "👤",
            "description": "Belongs to user A",
            "steps": [],
        },
        headers=headers_a,
    )
    agent_id = resp.json()["id"]

    # User B tries to access
    resp_b = await client.post(
        "/auth/register",
        json={
            "email": "agentuser2@example.com",
            "password": "StrongPass1!",
            "display_name": "Agent User 2",
        },
    )
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    resp = await client.get(f"/agents/{agent_id}", headers=headers_b)
    assert resp.status_code == 404
