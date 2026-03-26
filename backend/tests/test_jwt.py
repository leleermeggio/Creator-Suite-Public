from __future__ import annotations

import time
from pathlib import Path

import pytest

from backend.auth.jwt import create_access_token, create_refresh_token, decode_token

KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"


@pytest.fixture
def private_key():
    return (KEYS_DIR / "private.pem").read_text()


@pytest.fixture
def public_key():
    return (KEYS_DIR / "public.pem").read_text()


def test_create_and_decode_access_token(private_key, public_key):
    token = create_access_token(
        user_id="user-123", private_key=private_key, expire_minutes=15
    )
    payload = decode_token(token, public_key)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload
    assert "jti" in payload


def test_create_and_decode_refresh_token(private_key, public_key):
    token = create_refresh_token(
        user_id="user-456", private_key=private_key, expire_days=30
    )
    payload = decode_token(token, public_key)
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_expired_token_raises(private_key, public_key):
    token = create_access_token(
        user_id="user-789", private_key=private_key, expire_minutes=-1
    )
    with pytest.raises(Exception, match="expired|Expired"):
        decode_token(token, public_key)


def test_tampered_token_raises(private_key, public_key):
    token = create_access_token(
        user_id="user-000", private_key=private_key, expire_minutes=15
    )
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(Exception):
        decode_token(tampered, public_key)
