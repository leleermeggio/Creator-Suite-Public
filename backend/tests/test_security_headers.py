from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_security_headers_present(client):
    resp = await client.get("/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Strict-Transport-Security"] == "max-age=31536000"
    assert "X-Request-ID" in resp.headers
    assert resp.headers["Cache-Control"] == "no-store"
