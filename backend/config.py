from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./creator_suite_dev.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT RS256
    JWT_PRIVATE_KEY_PATH: str = "keys/private.pem"
    JWT_PUBLIC_KEY_PATH: str = "keys/public.pem"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Cloudflare R2
    R2_ENDPOINT_URL: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "creator-suite"

    # CORS — stored as comma-separated string, parsed via property
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # AI / Processing
    GOOGLE_API_KEY: str = ""
    WHISPER_MODEL: str = "small"
    GEMINI_MODEL: str = "gemini-2.0-flash"

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
