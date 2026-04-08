from __future__ import annotations

import logging

from cryptography.fernet import Fernet

from backend.config import get_settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    settings = get_settings()
    key = settings.OAUTH_ENCRYPTION_KEY
    if not key:
        raise ValueError("OAUTH_ENCRYPTION_KEY not set — cannot encrypt/decrypt tokens")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt an OAuth token for storage."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a stored OAuth token."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()
