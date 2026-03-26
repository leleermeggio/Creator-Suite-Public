from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt


def create_access_token(
    user_id: str, private_key: str, expire_minutes: int = 15
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def create_refresh_token(
    user_id: str, private_key: str, expire_days: int = 30
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=expire_days),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def decode_token(token: str, public_key: str) -> dict:
    return jwt.decode(token, public_key, algorithms=["RS256"])
