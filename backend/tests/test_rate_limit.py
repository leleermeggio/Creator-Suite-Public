from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _enable_rate_limiter(app):
    """Re-enable rate limiting for this test module."""
    app.state.limiter.enabled = True
    app.state.limiter.reset()
    yield
    app.state.limiter.enabled = False


@pytest.mark.asyncio
async def test_rate_limit_health_not_limited(client):
    """Health endpoint should respond normally under normal use."""
    for _ in range(5):
        resp = await client.get("/health")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_rate_limit_enforced_on_auth(client):
    """Auth endpoints should eventually return 429 when rate limit is exceeded."""
    statuses = []
    for _ in range(120):
        resp = await client.post("/auth/login", json={
            "email": "spam@example.com", "password": "x",
        })
        statuses.append(resp.status_code)
        if resp.status_code == 429:
            break
    assert 429 in statuses, "Rate limiter did not kick in after 120 requests"
