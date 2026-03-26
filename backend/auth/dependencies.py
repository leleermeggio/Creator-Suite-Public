from __future__ import annotations

from collections.abc import AsyncGenerator
from pathlib import Path

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import decode_token
from backend.config import get_settings
from backend.models.user import User

security = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Placeholder — overridden at app startup with real session factory."""
    raise RuntimeError("Database session not configured")
    yield  # noqa: F401 — makes this a generator


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    settings = get_settings()
    key_path = Path(settings.JWT_PUBLIC_KEY_PATH)
    if not key_path.is_absolute():
        key_path = Path(__file__).resolve().parent.parent / key_path
    public_key = key_path.read_text()

    try:
        payload = decode_token(credentials.credentials, public_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token"
        )

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user
