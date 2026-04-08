from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """Deep health check — verifies DB and Redis connectivity."""
    db_ok = False
    redis_ok = False

    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        logger.error("❌ Health check: DB unreachable", exc_info=True)

    try:
        import redis.asyncio as aioredis

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = aioredis.from_url(redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        redis_ok = True
    except Exception:
        logger.error("❌ Health check: Redis unreachable", exc_info=True)

    status_code = 200 if (db_ok and redis_ok) else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if (db_ok and redis_ok) else "degraded",
            "db": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        },
    )
