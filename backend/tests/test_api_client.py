from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_api_client_register_and_login(client):
    """API client should be able to register and login via the API."""
    from backend.telegram_bot.api_client import CreatorSuiteClient

    # Use the test client's base URL
    api = CreatorSuiteClient(base_url="http://test", http_client=client)

    tokens = await api.register("bot@example.com", "BotPass123!", "Bot User")
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    tokens2 = await api.login("bot@example.com", "BotPass123!")
    assert "access_token" in tokens2


@pytest.mark.asyncio
async def test_api_client_create_project(client):
    from backend.telegram_bot.api_client import CreatorSuiteClient

    api = CreatorSuiteClient(base_url="http://test", http_client=client)
    tokens = await api.register("proj@example.com", "BotPass123!", "Proj User")
    api.set_token(tokens["access_token"])

    project = await api.create_project("Test from Bot")
    assert project["title"] == "Test from Bot"
    assert "id" in project


@pytest.mark.asyncio
async def test_api_client_submit_job(client):
    from backend.telegram_bot.api_client import CreatorSuiteClient

    api = CreatorSuiteClient(base_url="http://test", http_client=client)
    tokens = await api.register("jobc@example.com", "BotPass123!", "Job User")
    api.set_token(tokens["access_token"])

    project = await api.create_project("Job Project")
    job = await api.submit_job(project["id"], "transcribe", {"language": "it"})
    assert job["type"] == "transcribe"
    assert job["status"] == "queued"
