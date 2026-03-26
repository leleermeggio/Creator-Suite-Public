# Creator Suite Phase 0 — Infrastructure Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FastAPI backend skeleton with auth, database, job queue, object storage, CI/CD, and refactor the Telegram bot as an API client — so Phase 1 can build features on solid infrastructure.

**Architecture:** Monolith FastAPI backend serving REST API. PostgreSQL via async SQLAlchemy 2.0. Celery + Redis for async job processing. Cloudflare R2 (S3-compatible) for media storage. JWT RS256 auth. Both the Flutter app (future) and the existing Telegram bot are API clients.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery, Redis, PostgreSQL, boto3 (R2), PyJWT + cryptography (RS256), bcrypt, pytest + httpx, Docker Compose

---

## File Structure

All new files live under `backend/` at the project root. The existing bot files (`bot.py`, `transcriber.py`, etc.) remain at root and are refactored in Task 14.

**Project root:**
```
pyproject.toml                  # pytest pythonpath config (so `from backend.xxx` works)
```

```
backend/
├── __init__.py                 # Package marker
├── main.py                     # FastAPI app factory, startup/shutdown, middleware wiring
├── config.py                   # Pydantic Settings — all env vars, RS256 key loading
├── database.py                 # Async engine, session factory, Base
├── auth/
│   ├── __init__.py
│   ├── jwt.py                  # create_access_token, create_refresh_token, decode_token
│   ├── passwords.py            # hash_password, verify_password
│   ├── dependencies.py         # get_current_user FastAPI dependency
│   ├── routes.py               # POST /auth/register, /auth/login, /auth/refresh
│   └── schemas.py              # RegisterRequest, LoginRequest, TokenResponse, etc.
├── models/
│   ├── __init__.py             # Re-export all models
│   ├── user.py                 # User ORM model
│   ├── project.py              # Project ORM model
│   ├── media_asset.py          # MediaAsset ORM model
│   ├── job.py                  # Job ORM model
│   └── enums.py                # JobStatus, JobType enums
├── schemas/
│   ├── __init__.py
│   └── jobs.py                 # JobCreate, JobResponse schemas
├── routes/
│   ├── __init__.py
│   ├── health.py               # GET /health
│   ├── projects.py             # POST /projects
│   └── jobs.py                 # POST /jobs, GET /jobs/{id}, GET /jobs
├── middleware/
│   ├── __init__.py
│   ├── rate_limit.py           # slowapi rate limiter setup
│   └── security.py             # Security headers middleware
├── storage/
│   ├── __init__.py
│   └── r2.py                   # R2Client: presigned upload/download URLs
├── workers/
│   ├── __init__.py
│   ├── celery_app.py           # Celery instance + config
│   └── tasks.py                # Example ping task + job executor skeleton
├── migrations/
│   ├── env.py                  # Alembic env (async)
│   └── versions/               # Auto-generated migration files
├── alembic.ini                 # Alembic config
├── requirements.txt            # Backend-only dependencies
├── Dockerfile                  # Backend Docker image
├── docker-compose.yml          # API + PostgreSQL + Redis (dev)
├── docker-compose.worker.yml   # Worker (connects to cloud Redis for prod)
├── .env.example                # Template
├── keys/                       # RS256 key pair (gitignored)
│   ├── private.pem
│   └── public.pem
└── tests/
    ├── __init__.py
    ├── conftest.py             # Fixtures: async client, test DB, test user
    ├── test_config.py          # Config loads correctly
    ├── test_passwords.py       # Hash + verify
    ├── test_jwt.py             # Token create + decode + expiry
    ├── test_auth_routes.py     # Register, login, refresh, error cases
    ├── test_auth_dependency.py # Protected route access
    ├── test_models.py          # ORM model creation + constraints
    ├── test_rate_limit.py      # Rate limiting kicks in
    ├── test_security_headers.py# Security headers present
    ├── test_auth_schemas.py    # Schema validation (email, password length)
    ├── test_r2.py              # Presigned URL generation
    ├── test_celery.py          # Task dispatch + result
    └── test_jobs_routes.py     # Job CRUD endpoints
```

**`.github/workflows/`** (at project root):
```
.github/
└── workflows/
    └── backend-ci.yml          # Lint + test on push/PR
```

**Modified existing files:**
- `bot.py` → refactored to use `backend/` API via httpx (Task 14)
- `.gitignore` → add `backend/keys/`, `*.pem`

---

## Task 1: Project Scaffolding + Config

**Files:**
- Create: `pyproject.toml` (project root)
- Create: `backend/__init__.py`
- Create: `backend/config.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 1: Create pyproject.toml at project root**

This ensures `from backend.xxx` imports work when running tests.

```toml
# pyproject.toml (project root)
[tool.pytest.ini_options]
pythonpath = ["."]
asyncio_mode = "auto"
testpaths = ["backend/tests"]
```

- [ ] **Step 2: Create backend/__init__.py**

```python
# backend/__init__.py
```
(empty — marks backend as a Python package)

- [ ] **Step 3: Create backend directory and requirements.txt**

```
backend/requirements.txt
```
```txt
fastapi>=0.115,<1.0
uvicorn[standard]>=0.30
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29
alembic>=1.13
pydantic[email]>=2.0
pydantic-settings>=2.0
bcrypt>=4.0
PyJWT>=2.8
cryptography>=42.0
celery[redis]>=5.4
redis>=5.0
boto3>=1.34
slowapi>=0.1.9
httpx>=0.27
python-multipart>=0.0.9
pytest>=8.0
pytest-asyncio>=0.24
pytest-cov>=5.0
anyio>=4.0
aiosqlite>=0.20
ruff>=0.5
```

- [ ] **Step 4: Create .env.example**

```
backend/.env.example
```
```env
# === Required ===
DATABASE_URL=postgresql+asyncpg://creator:creator@localhost:5432/creator_suite
REDIS_URL=redis://localhost:6379/0

# === Auth (RS256) ===
JWT_PRIVATE_KEY_PATH=keys/private.pem
JWT_PUBLIC_KEY_PATH=keys/public.pem
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# === Object Storage (Cloudflare R2) ===
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=creator-suite

# === Optional ===
GOOGLE_API_KEY=
WHISPER_MODEL=small
ALLOWED_ORIGINS=http://localhost:3000
```

- [ ] **Step 5: Write the failing test for config**

```python
# backend/tests/__init__.py
```
(empty file)

```python
# backend/tests/test_config.py
import os
import pytest


def test_settings_loads_from_env(monkeypatch):
    """Settings should load all required values from environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://example.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "test_key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "test_secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")

    from backend.config import Settings

    s = Settings()
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@localhost/test"
    assert s.REDIS_URL == "redis://localhost:6379/0"
    assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 15
    assert s.JWT_REFRESH_TOKEN_EXPIRE_DAYS == 30
    assert s.R2_BUCKET_NAME == "test-bucket"
    assert s.ALLOWED_ORIGINS == "http://localhost:3000"
    assert s.allowed_origins == ["http://localhost:3000"]


def test_settings_custom_origins(monkeypatch):
    """ALLOWED_ORIGINS should parse comma-separated string."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://example.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://app.example.com,https://api.example.com")

    from backend.config import Settings

    s = Settings()
    assert s.allowed_origins == ["https://app.example.com", "https://api.example.com"]
```

- [ ] **Step 6: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.config'`

- [ ] **Step 7: Implement config.py**

```python
# backend/config.py
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

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

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 8: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_config.py -v`
Expected: PASS (both tests)

- [ ] **Step 9: Commit**

```bash
git add pyproject.toml backend/__init__.py backend/config.py backend/requirements.txt backend/.env.example backend/tests/__init__.py backend/tests/test_config.py
git commit -m "feat(backend): add project scaffolding, pyproject.toml, and config module"
```

---

## Task 2: Database Setup (SQLAlchemy + Alembic + User Model)

**Files:**
- Create: `backend/database.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/user.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test for User model**

```python
# backend/tests/conftest.py
from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from backend.database import Base


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """In-memory SQLite session for tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

```python
# backend/tests/test_models.py
from __future__ import annotations

import pytest
from sqlalchemy import select

from backend.models.user import User


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="test@example.com", hashed_password="fakehash", display_name="Tester")
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    fetched = result.scalar_one()
    assert fetched.email == "test@example.com"
    assert fetched.display_name == "Tester"
    assert fetched.id is not None
    assert fetched.created_at is not None
    assert fetched.is_active is True


@pytest.mark.asyncio
async def test_user_email_unique(db_session):
    """Duplicate emails should raise IntegrityError."""
    from sqlalchemy.exc import IntegrityError

    db_session.add(User(email="dupe@example.com", hashed_password="h1", display_name="A"))
    await db_session.commit()

    db_session.add(User(email="dupe@example.com", hashed_password="h2", display_name="B"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.database'`

- [ ] **Step 3: Implement database.py and User model**

```python
# backend/database.py
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def create_engine(database_url: str):
    return create_async_engine(database_url, echo=False)


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
```

```python
# backend/models/__init__.py
from backend.models.user import User

__all__ = ["User"]
```

```python
# backend/models/user.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_models.py -v`
Expected: PASS (both tests)

- [ ] **Step 5: Set up Alembic**

Run:
```bash
cd backend && python -m alembic init migrations
```

Then replace `alembic.ini` and `migrations/env.py`:

```ini
# backend/alembic.ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql+asyncpg://creator:creator@localhost:5432/creator_suite

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

```python
# backend/migrations/env.py
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from backend.config import get_settings
from backend.database import Base

# Import all models so Alembic sees them
from backend.models import *  # noqa: F401, F403

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = get_settings().DATABASE_URL
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(get_settings().DATABASE_URL)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 6: Commit**

```bash
git add backend/database.py backend/models/ backend/tests/conftest.py backend/tests/test_models.py backend/alembic.ini backend/migrations/
git commit -m "feat(backend): add database setup, User model, and Alembic migrations"
```

---

## Task 3: Password Hashing

**Files:**
- Create: `backend/auth/__init__.py`
- Create: `backend/auth/passwords.py`
- Create: `backend/tests/test_passwords.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_passwords.py
from backend.auth.passwords import hash_password, verify_password


def test_hash_and_verify():
    pw = "SuperSecret123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True


def test_wrong_password_fails():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_different_hashes_for_same_password():
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2  # bcrypt salts differ
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_passwords.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement**

```python
# backend/auth/__init__.py
```
(empty)

```python
# backend/auth/passwords.py
from __future__ import annotations

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_passwords.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add backend/auth/__init__.py backend/auth/passwords.py backend/tests/test_passwords.py
git commit -m "feat(backend): add bcrypt password hashing"
```

---

## Task 4: JWT RS256 Token Utilities

**Files:**
- Create: `backend/auth/jwt.py`
- Create: `backend/tests/test_jwt.py`
- Create: `backend/keys/` (gitignored, generated for tests)

- [ ] **Step 1: Generate RS256 key pair for tests**

Run:
```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
echo "keys/" >> backend/.gitignore
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_jwt.py
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_jwt.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Implement**

```python
# backend/auth/jwt.py
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_jwt.py -v`
Expected: PASS (all 4)

- [ ] **Step 6: Commit**

```bash
git add backend/auth/jwt.py backend/tests/test_jwt.py backend/.gitignore
git commit -m "feat(backend): add JWT RS256 token creation and verification"
```

---

## Task 5: Auth Schemas

**Files:**
- Create: `backend/auth/schemas.py`
- Create: `backend/tests/test_auth_schemas.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_auth_schemas.py
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.auth.schemas import RegisterRequest, LoginRequest


def test_register_rejects_short_password():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="short", display_name="X")


def test_register_rejects_invalid_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="StrongPass1!", display_name="X")


def test_register_rejects_empty_display_name():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="StrongPass1!", display_name="")


def test_register_accepts_valid_input():
    r = RegisterRequest(email="a@b.com", password="StrongPass1!", display_name="User")
    assert r.email == "a@b.com"


def test_login_rejects_invalid_email():
    with pytest.raises(ValidationError):
        LoginRequest(email="bad", password="whatever")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_auth_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.auth.schemas'`

- [ ] **Step 3: Implement auth schemas**

```python
# backend/auth/schemas.py
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    is_active: bool

    model_config = {"from_attributes": True}
```

Note: `pydantic[email]>=2.0` (which pulls in `email-validator`) is already in `backend/requirements.txt` from Task 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_auth_schemas.py -v`
Expected: PASS (all 5)

- [ ] **Step 5: Commit**

```bash
git add backend/auth/schemas.py backend/tests/test_auth_schemas.py
git commit -m "feat(backend): add auth Pydantic schemas with validation tests"
```

---

## Task 6: Auth Routes (Register, Login, Refresh)

**Files:**
- Create: `backend/auth/routes.py`
- Create: `backend/tests/test_auth_routes.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_auth_routes.py
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.database import Base


@pytest_asyncio.fixture
async def app():
    """Create a test app with in-memory SQLite."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from backend.main import create_app

    application = create_app(session_factory=session_factory)
    yield application

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/auth/register", json={
        "email": "new@example.com",
        "password": "StrongPass1!",
        "display_name": "New User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {
        "email": "dupe@example.com",
        "password": "StrongPass1!",
        "display_name": "User",
    }
    resp1 = await client.post("/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/auth/register", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/auth/register", json={
        "email": "login@example.com",
        "password": "StrongPass1!",
        "display_name": "Login User",
    })
    resp = await client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "StrongPass1!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/register", json={
        "email": "wrong@example.com",
        "password": "StrongPass1!",
        "display_name": "User",
    })
    resp = await client.post("/auth/login", json={
        "email": "wrong@example.com",
        "password": "WrongPassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    resp = await client.post("/auth/login", json={
        "email": "ghost@example.com",
        "password": "Whatever1!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    reg = await client.post("/auth/register", json={
        "email": "refresh@example.com",
        "password": "StrongPass1!",
        "display_name": "Refresh User",
    })
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_with_invalid_token(client):
    resp = await client.post("/auth/refresh", json={
        "refresh_token": "invalid.token.here",
    })
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_auth_routes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.main'`

- [ ] **Step 3: Create the auth dependencies module**

```python
# backend/auth/dependencies.py
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
    yield  # noqa: unreachable — makes this a generator


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token")

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

- [ ] **Step 4: Implement auth routes**

```python
# backend/auth/routes.py
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_db
from backend.auth.jwt import create_access_token, create_refresh_token, decode_token
from backend.auth.passwords import hash_password, verify_password
from backend.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from backend.config import get_settings
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _read_key(path: str) -> str:
    p = Path(path)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent.parent / p
    return p.read_text()


def _make_tokens(user_id: str) -> TokenResponse:
    settings = get_settings()
    private_key = _read_key(settings.JWT_PRIVATE_KEY_PATH)
    return TokenResponse(
        access_token=create_access_token(
            user_id, private_key, settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        ),
        refresh_token=create_refresh_token(
            user_id, private_key, settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        ),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    await db.refresh(user)
    return _make_tokens(user.id)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _make_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    settings = get_settings()
    public_key = _read_key(settings.JWT_PUBLIC_KEY_PATH)
    try:
        payload = decode_token(body.refresh_token, public_key)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    return _make_tokens(payload["sub"])
```

> **Note:** Rate limit decorators (`@limiter.limit("5/minute")`) are added to these routes in Task 9, after the middleware module is created.

- [ ] **Step 5: Create minimal main.py (app factory)**

This is needed for the auth route tests to pass. We'll flesh it out fully in Task 9.

```python
# backend/main.py
from __future__ import annotations

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.auth.routes import router as auth_router


def _get_db_dependency(session_factory: async_sessionmaker[AsyncSession]):
    async def get_db():
        async with session_factory() as session:
            yield session
    return get_db


def create_app(session_factory: async_sessionmaker[AsyncSession] | None = None) -> FastAPI:
    app = FastAPI(title="Creator Suite API", version="0.1.0")

    # Database dependency — always configured (production uses settings, tests inject their own)
    if session_factory is None:
        from backend.config import get_settings
        from backend.database import create_engine, create_session_factory
        settings = get_settings()
        engine = create_engine(settings.DATABASE_URL)
        session_factory = create_session_factory(engine)

    from backend.auth.dependencies import get_db
    app.dependency_overrides[get_db] = _get_db_dependency(session_factory)

    app.include_router(auth_router)

    return app
```

- [ ] **Step 6: Update conftest.py with shared fixtures for auth route tests**

Add to `backend/tests/conftest.py`:

```python
# Add these imports and fixtures to the existing conftest.py:

import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from backend.database import Base


@pytest_asyncio.fixture
async def app(tmp_path, monkeypatch):
    """Create a test FastAPI app with in-memory DB and temp RS256 keys."""
    # Generate temp RS256 keys using cryptography (cross-platform, no openssl CLI needed)
    key_dir = tmp_path / "keys"
    key_dir.mkdir()
    priv = key_dir / "private.pem"
    pub = key_dir / "public.pem"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv.write_bytes(private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))
    pub.write_bytes(private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ))

    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", str(priv))
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", str(pub))

    # Clear cached settings
    from backend.config import get_settings
    get_settings.cache_clear()

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from backend.main import create_app
    application = create_app(session_factory=session_factory)
    yield application

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        yield c
```

Simplify `test_auth_routes.py` to use shared fixtures — remove the local `app`/`client` fixtures from the test file (they now live in `conftest.py`). The test functions themselves remain unchanged.

- [ ] **Step 7: Run tests to verify they pass**

Run: `python -m pytest backend/tests/test_auth_routes.py -v`
Expected: PASS (all 7 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/main.py backend/auth/routes.py backend/auth/dependencies.py backend/auth/schemas.py backend/tests/conftest.py backend/tests/test_auth_routes.py
git commit -m "feat(backend): add auth routes (register, login, refresh) with JWT RS256"
```

---

## Task 7: Auth Dependency (Protected Routes)

**Files:**
- Create: `backend/tests/test_auth_dependency.py`
- Modify: `backend/auth/dependencies.py` (already created in Task 6)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_auth_dependency.py
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    """Accessing a protected route without a token should return 403."""
    resp = await client.get("/auth/me")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_protected_route_with_valid_token(client):
    """Accessing a protected route with a valid token should return user info."""
    reg = await client.post("/auth/register", json={
        "email": "me@example.com",
        "password": "StrongPass1!",
        "display_name": "Me User",
    })
    token = reg.json()["access_token"]

    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["display_name"] == "Me User"


@pytest.mark.asyncio
async def test_protected_route_with_invalid_token(client):
    """An invalid/malformed token should be rejected."""
    resp = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer expired.invalid.token"},
    )
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_auth_dependency.py -v`
Expected: FAIL — 404 (route `/auth/me` doesn't exist)

- [ ] **Step 3: Add /auth/me route**

Add to `backend/auth/routes.py`:

```python
from backend.auth.dependencies import get_current_user
from backend.auth.schemas import UserResponse

@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_auth_dependency.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add backend/auth/routes.py backend/tests/test_auth_dependency.py
git commit -m "feat(backend): add /auth/me protected route with JWT dependency"
```

---

## Task 8: Core Data Models (Project, MediaAsset, Job)

**Files:**
- Create: `backend/models/enums.py`
- Create: `backend/models/project.py`
- Create: `backend/models/media_asset.py`
- Create: `backend/models/job.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_models.py`:

```python
from backend.models.project import Project
from backend.models.media_asset import MediaAsset
from backend.models.job import Job
from backend.models.enums import JobStatus, JobType


@pytest.mark.asyncio
async def test_create_project(db_session):
    user = User(email="proj@test.com", hashed_password="h", display_name="P")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="My Video")
    db_session.add(project)
    await db_session.commit()

    result = await db_session.execute(select(Project).where(Project.user_id == user.id))
    p = result.scalar_one()
    assert p.title == "My Video"
    assert p.user_id == user.id


@pytest.mark.asyncio
async def test_create_media_asset(db_session):
    user = User(email="media@test.com", hashed_password="h", display_name="M")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="Media Test")
    db_session.add(project)
    await db_session.commit()

    asset = MediaAsset(
        project_id=project.id,
        user_id=user.id,
        filename="clip01.mp4",
        storage_key="media/user-1/proj-1/clip01.mp4",
        mime_type="video/mp4",
        size_bytes=1_000_000,
    )
    db_session.add(asset)
    await db_session.commit()

    result = await db_session.execute(select(MediaAsset).where(MediaAsset.project_id == project.id))
    a = result.scalar_one()
    assert a.filename == "clip01.mp4"
    assert a.size_bytes == 1_000_000


@pytest.mark.asyncio
async def test_create_job(db_session):
    user = User(email="job@test.com", hashed_password="h", display_name="J")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="Job Test")
    db_session.add(project)
    await db_session.commit()

    job = Job(
        project_id=project.id,
        user_id=user.id,
        type=JobType.TRANSCRIBE,
        status=JobStatus.QUEUED,
        input_params={"language": "it"},
    )
    db_session.add(job)
    await db_session.commit()

    result = await db_session.execute(select(Job).where(Job.project_id == project.id))
    j = result.scalar_one()
    assert j.type == JobType.TRANSCRIBE
    assert j.status == JobStatus.QUEUED
    assert j.progress == 0
    assert j.input_params == {"language": "it"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement models**

```python
# backend/models/enums.py
from __future__ import annotations

import enum


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, enum.Enum):
    TRANSCRIBE = "transcribe"
    JUMPCUT = "jumpcut"
    EXPORT = "export"
    CAPTION = "caption"
    AUDIO_CLEANUP = "audio_cleanup"
    SMART_SEARCH = "smart_search"
    THUMBNAIL = "thumbnail"
    CONVERT = "convert"
    TTS = "tts"
    TRANSLATE = "translate"
```

```python
# backend/models/project.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

```python
# backend/models/media_asset.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
```

```python
# backend/models/job.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import JSON

from backend.database import Base
from backend.models.enums import JobStatus, JobType


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[JobType] = mapped_column(nullable=False)
    status: Mapped[JobStatus] = mapped_column(default=JobStatus.QUEUED, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    input_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/__init__.py
from backend.models.user import User
from backend.models.project import Project
from backend.models.media_asset import MediaAsset
from backend.models.job import Job
from backend.models.enums import JobStatus, JobType

__all__ = ["User", "Project", "MediaAsset", "Job", "JobStatus", "JobType"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_models.py -v`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/
git commit -m "feat(backend): add Project, MediaAsset, Job models with enums"
```

---

## Task 9: Security Middleware (Rate Limiting + Headers)

**Files:**
- Create: `backend/middleware/__init__.py`
- Create: `backend/middleware/rate_limit.py`
- Create: `backend/middleware/security.py`
- Create: `backend/tests/test_security_headers.py`
- Create: `backend/tests/test_rate_limit.py`

- [ ] **Step 1: Write the failing tests for security headers and rate limiting**

```python
# backend/tests/test_security_headers.py
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
```

```python
# backend/tests/test_rate_limit.py
from __future__ import annotations

import pytest


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_security_headers.py backend/tests/test_rate_limit.py -v`
Expected: FAIL — 404 (no `/health` route), missing headers, no rate limiting

- [ ] **Step 3: Implement security headers middleware**

```python
# backend/middleware/__init__.py
```
(empty)

```python
# backend/middleware/security.py
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
        response.headers["X-Request-ID"] = str(uuid.uuid4())
        response.headers["Cache-Control"] = "no-store"
        return response
```

- [ ] **Step 4: Implement rate limiter**

```python
# backend/middleware/rate_limit.py
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

- [ ] **Step 5: Add rate limit decorators to auth routes**

Update `backend/auth/routes.py` — add the limiter import, `Request` parameter, and decorators:

```python
# Add these imports at the top of backend/auth/routes.py:
from fastapi import APIRouter, Depends, HTTPException, Request, status  # add Request
from backend.middleware.rate_limit import limiter  # new import

# Then add @limiter.limit and request: Request to each route:

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    ...  # body unchanged

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    ...  # body unchanged

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("5/minute")
async def refresh(request: Request, body: RefreshRequest):
    ...  # body unchanged
```

- [ ] **Step 6: Add /health route**

```python
# backend/routes/__init__.py
```
(empty)

```python
# backend/routes/health.py
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Wire middleware and health route into main.py**

Update `backend/main.py`:

```python
# backend/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.auth.dependencies import get_db
from backend.auth.routes import router as auth_router
from backend.config import get_settings
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.routes.health import router as health_router


def _get_db_dependency(session_factory: async_sessionmaker[AsyncSession]):
    async def dep():
        async with session_factory() as session:
            yield session
    return dep


def create_app(session_factory: async_sessionmaker[AsyncSession] | None = None) -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="Creator Suite API", version="0.1.0")

    # Middleware (order matters — last added = first executed)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Database dependency — always configured (production uses settings, tests inject their own)
    if session_factory is None:
        from backend.database import create_engine, create_session_factory
        engine = create_engine(settings.DATABASE_URL)
        session_factory = create_session_factory(engine)
    app.dependency_overrides[get_db] = _get_db_dependency(session_factory)

    # Routes
    app.include_router(health_router)
    app.include_router(auth_router)

    return app
```

- [ ] **Step 8: Run all middleware tests**

Run: `python -m pytest backend/tests/test_security_headers.py backend/tests/test_rate_limit.py -v`
Expected: PASS (all 3 tests — headers, health not limited, auth rate limited)

- [ ] **Step 9: Commit**

```bash
git add backend/middleware/ backend/routes/ backend/main.py backend/auth/routes.py backend/tests/test_security_headers.py backend/tests/test_rate_limit.py
git commit -m "feat(backend): add security headers, CORS, rate limiting, health endpoint"
```

---

## Task 10: Cloudflare R2 Storage (Presigned URLs)

**Files:**
- Create: `backend/storage/__init__.py`
- Create: `backend/storage/r2.py`
- Create: `backend/tests/test_r2.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_r2.py
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.storage.r2 import R2Client


@pytest.fixture
def r2():
    return R2Client(
        endpoint_url="https://fake.r2.cloudflarestorage.com",
        access_key_id="test-key",
        secret_access_key="test-secret",
        bucket_name="test-bucket",
    )


def test_generate_upload_url(r2):
    with patch.object(r2, "_client") as mock_client:
        mock_client.generate_presigned_url.return_value = "https://signed-upload-url"
        url = r2.generate_upload_url(
            key="media/user-1/proj-1/clip.mp4",
            content_type="video/mp4",
            expires_in=3600,
        )
        assert url == "https://signed-upload-url"
        mock_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "media/user-1/proj-1/clip.mp4",
                "ContentType": "video/mp4",
            },
            ExpiresIn=3600,
        )


def test_generate_download_url(r2):
    with patch.object(r2, "_client") as mock_client:
        mock_client.generate_presigned_url.return_value = "https://signed-download-url"
        url = r2.generate_download_url(
            key="media/user-1/proj-1/clip.mp4",
            expires_in=3600,
        )
        assert url == "https://signed-download-url"
        mock_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "media/user-1/proj-1/clip.mp4",
            },
            ExpiresIn=3600,
        )


def test_storage_key_generation(r2):
    key = r2.make_storage_key("user-abc", "proj-123", "my video.mp4")
    assert key == "media/user-abc/proj-123/my video.mp4"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_r2.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement R2 client**

```python
# backend/storage/__init__.py
```
(empty)

```python
# backend/storage/r2.py
from __future__ import annotations

import boto3
from botocore.config import Config


class R2Client:
    def __init__(
        self,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
    ):
        self._bucket = bucket_name
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def generate_upload_url(
        self, key: str, content_type: str, expires_in: int = 3600
    ) -> str:
        return self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def generate_download_url(self, key: str, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )

    def make_storage_key(self, user_id: str, project_id: str, filename: str) -> str:
        return f"media/{user_id}/{project_id}/{filename}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_r2.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add backend/storage/ backend/tests/test_r2.py
git commit -m "feat(backend): add Cloudflare R2 presigned URL client"
```

---

## Task 11: Celery + Redis Job Queue

**Files:**
- Create: `backend/workers/__init__.py`
- Create: `backend/workers/celery_app.py`
- Create: `backend/workers/tasks.py`
- Create: `backend/tests/test_celery.py`

- [ ] **Step 1: Write the failing test**

We test Celery in "eager" mode (synchronous, no Redis needed).

```python
# backend/tests/test_celery.py
from __future__ import annotations

import pytest


@pytest.fixture
def celery_app():
    from backend.workers.celery_app import celery
    celery.conf.update(task_always_eager=True, task_eager_propagates=True)
    return celery


def test_ping_task(celery_app):
    from backend.workers.tasks import ping
    result = ping.delay()
    assert result.get() == "pong"


def test_process_job_task(celery_app):
    from backend.workers.tasks import process_job
    result = process_job.delay(job_id="test-job-123", job_type="transcribe")
    data = result.get()
    assert data["job_id"] == "test-job-123"
    assert data["status"] == "completed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_celery.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement Celery app and tasks**

```python
# backend/workers/__init__.py
```
(empty)

```python
# backend/workers/celery_app.py
from __future__ import annotations

import os

from celery import Celery

# Read directly from env (not Settings) because Celery initializes before FastAPI
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "creator_suite",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["backend.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,  # 30 min max per job
    worker_prefetch_multiplier=1,
    worker_concurrency=2,
)
```

```python
# backend/workers/tasks.py
from __future__ import annotations

import logging

from backend.workers.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="ping")
def ping() -> str:
    return "pong"


@celery.task(name="process_job", bind=True)
def process_job(self, job_id: str, job_type: str) -> dict:
    """Process an AI/media job. Skeleton — each job type will be implemented in Phase 1."""
    logger.info("Processing job %s (type=%s)", job_id, job_type)

    # TODO: Phase 1 — dispatch to actual service based on job_type
    # For now, return a completed stub
    return {
        "job_id": job_id,
        "job_type": job_type,
        "status": "completed",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_celery.py -v`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add backend/workers/ backend/tests/test_celery.py
git commit -m "feat(backend): add Celery + Redis job queue with ping and process_job tasks"
```

---

## Task 12: Jobs API Routes

**Files:**
- Create: `backend/schemas/__init__.py`
- Create: `backend/schemas/jobs.py`
- Create: `backend/routes/jobs.py`
- Create: `backend/tests/test_jobs_routes.py`
- Modify: `backend/main.py` (add jobs router)

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_jobs_routes.py
from __future__ import annotations

import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post("/auth/register", json={
        "email": "jobuser@example.com",
        "password": "StrongPass1!",
        "display_name": "Job User",
    })
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects",
        json={"title": "Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_job_requires_auth(client):
    resp = await client.post("/jobs", json={"project_id": "x", "type": "transcribe"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_and_get_job(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create job
    resp = await client.post("/jobs", json={
        "project_id": project_id,
        "type": "transcribe",
        "input_params": {"language": "it"},
    }, headers=headers)
    assert resp.status_code == 201
    job = resp.json()
    assert job["type"] == "transcribe"
    assert job["status"] == "queued"
    assert job["progress"] == 0
    job_id = job["id"]

    # Get job
    resp = await client.get(f"/jobs/{job_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == job_id


@pytest.mark.asyncio
async def test_list_jobs_for_project(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/jobs", json={
        "project_id": project_id, "type": "transcribe",
    }, headers=headers)
    await client.post("/jobs", json={
        "project_id": project_id, "type": "jumpcut",
    }, headers=headers)

    resp = await client.get(f"/jobs?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_jobs_routes.py -v`
Expected: FAIL — routes don't exist

- [ ] **Step 3: Create job schemas**

```python
# backend/schemas/__init__.py
```
(empty)

```python
# backend/schemas/jobs.py
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.models.enums import JobStatus, JobType


class JobCreate(BaseModel):
    project_id: str
    type: JobType
    input_params: dict | None = None


class JobResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    type: JobType
    status: JobStatus
    progress: int
    input_params: dict | None
    result: dict | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Create a minimal projects route**

Jobs tests need a project. Add a minimal `/projects` POST:

```python
# backend/routes/projects.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.project import Project
from backend.models.user import User

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    title: str
    description: str | None

    model_config = {"from_attributes": True}


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(user_id=user.id, title=body.title, description=body.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project
```

- [ ] **Step 5: Create jobs route**

```python
# backend/routes/jobs.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.job import Job
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.jobs import JobCreate, JobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify project belongs to user
    result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    job = Job(
        project_id=body.project_id,
        user_id=user.id,
        type=body.type,
        input_params=body.input_params,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # TODO: Phase 1 — dispatch to Celery here
    # from backend.workers.tasks import process_job
    # process_job.delay(job_id=job.id, job_type=job.type.value)

    return job


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/", response_model=list[JobResponse])
async def list_jobs(
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.project_id == project_id, Job.user_id == user.id)
        .order_by(Job.created_at.desc())
    )
    return list(result.scalars().all())
```

- [ ] **Step 6: Wire new routers into main.py**

Add to `backend/main.py` imports and router registration:

```python
from backend.routes.projects import router as projects_router
from backend.routes.jobs import router as jobs_router
```

Inside `create_app`, after the existing `app.include_router` calls:
```python
    app.include_router(projects_router)
    app.include_router(jobs_router)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `python -m pytest backend/tests/test_jobs_routes.py -v`
Expected: PASS (all 3)

- [ ] **Step 8: Commit**

```bash
git add backend/schemas/ backend/routes/projects.py backend/routes/jobs.py backend/main.py backend/tests/test_jobs_routes.py
git commit -m "feat(backend): add jobs and projects API routes with auth"
```

---

## Task 13: Docker Configuration

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/docker-compose.yml`
- Create: `backend/docker-compose.worker.yml`

- [ ] **Step 1: Create backend Dockerfile**

The Dockerfile lives in `backend/` but all code imports use `from backend.xxx`, so we must copy files into a `backend/` subdirectory inside the container.

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps for asyncpg, ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app/backend/

EXPOSE 8000

CMD ["uvicorn", "backend.main:create_app", "--host", "0.0.0.0", "--port", "8000", "--factory"]
```

- [ ] **Step 2: Create dev docker-compose.yml**

```yaml
# backend/docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./keys:/app/backend/keys:ro

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: creator
      POSTGRES_PASSWORD: creator
      POSTGRES_DB: creator_suite
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U creator"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  worker:
    build: .
    command: celery -A backend.workers.celery_app worker --loglevel=info --concurrency=2
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./keys:/app/backend/keys:ro

volumes:
  pgdata:
```

- [ ] **Step 3: Create production worker compose file**

```yaml
# backend/docker-compose.worker.yml
version: "3.8"

services:
  worker:
    build: .
    command: celery -A backend.workers.celery_app worker --loglevel=info --concurrency=2
    environment:
      REDIS_URL: ${UPSTASH_REDIS_URL}
      R2_ENDPOINT_URL: ${R2_ENDPOINT_URL}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME}
    restart: unless-stopped
```

- [ ] **Step 4: Verify Dockerfile builds**

Run: `cd backend && docker build -t creator-suite-api .`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/docker-compose.yml backend/docker-compose.worker.yml
git commit -m "feat(backend): add Docker configuration for API, worker, PostgreSQL, Redis"
```

---

## Task 14: CI/CD Pipeline (GitHub Actions)

**Files:**
- Create: `.github/workflows/backend-ci.yml`

- [ ] **Step 1: Create the CI workflow**

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI

on:
  push:
    paths:
      - "backend/**"
      - ".github/workflows/backend-ci.yml"
  pull_request:
    paths:
      - "backend/**"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install ruff
        run: pip install ruff
      - name: Lint
        run: cd backend && ruff check .
      - name: Format check
        run: cd backend && ruff format --check .

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: cd backend && pip install -r requirements.txt
      - name: Generate test RS256 keys
        run: |
          python -c "
          from cryptography.hazmat.primitives.asymmetric import rsa
          from cryptography.hazmat.primitives import serialization
          from pathlib import Path
          Path('backend/keys').mkdir(parents=True, exist_ok=True)
          pk = rsa.generate_private_key(public_exponent=65537, key_size=2048)
          Path('backend/keys/private.pem').write_bytes(pk.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
          Path('backend/keys/public.pem').write_bytes(pk.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
          "
      - name: Run tests
        env:
          DATABASE_URL: "sqlite+aiosqlite:///:memory:"
          REDIS_URL: "redis://localhost:6379/0"
          JWT_PRIVATE_KEY_PATH: "keys/private.pem"
          JWT_PUBLIC_KEY_PATH: "keys/public.pem"
        run: python -m pytest backend/tests/ -v --tb=short --cov=backend --cov-report=term-missing
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/backend-ci.yml
git commit -m "ci: add GitHub Actions backend lint + test pipeline"
```

---

## Task 15: Telegram Bot Refactored as API Client

**Files:**
- Create: `backend/telegram_bot/__init__.py`
- Create: `backend/telegram_bot/api_client.py`
- Create: `backend/tests/test_api_client.py`

This task creates a thin HTTP client that the Telegram bot will use to talk to the backend API instead of calling service modules directly. The full bot.py migration is Phase 1 work — here we build the client library.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_api_client.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_api_client.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement the API client**

```python
# backend/telegram_bot/__init__.py
```
(empty)

```python
# backend/telegram_bot/api_client.py
from __future__ import annotations

import httpx


class CreatorSuiteClient:
    """Thin async HTTP client for the Creator Suite backend API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        http_client: httpx.AsyncClient | None = None,
    ):
        self._base_url = base_url
        self._client = http_client
        self._token: str | None = None

    def set_token(self, token: str) -> None:
        self._token = token

    @property
    def _headers(self) -> dict[str, str]:
        if self._token:
            return {"Authorization": f"Bearer {self._token}"}
        return {}

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(base_url=self._base_url)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        client = await self._get_client()
        resp = await client.request(method, path, headers=self._headers, **kwargs)
        resp.raise_for_status()
        return resp.json()

    async def register(self, email: str, password: str, display_name: str) -> dict:
        return await self._request("POST", "/auth/register", json={
            "email": email, "password": password, "display_name": display_name,
        })

    async def login(self, email: str, password: str) -> dict:
        return await self._request("POST", "/auth/login", json={
            "email": email, "password": password,
        })

    async def refresh_token(self, refresh_token: str) -> dict:
        return await self._request("POST", "/auth/refresh", json={
            "refresh_token": refresh_token,
        })

    async def create_project(self, title: str, description: str | None = None) -> dict:
        return await self._request("POST", "/projects/", json={
            "title": title, "description": description,
        })

    async def submit_job(
        self, project_id: str, job_type: str, input_params: dict | None = None
    ) -> dict:
        return await self._request("POST", "/jobs/", json={
            "project_id": project_id, "type": job_type, "input_params": input_params,
        })

    async def get_job(self, job_id: str) -> dict:
        return await self._request("GET", f"/jobs/{job_id}")

    async def list_jobs(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/jobs/?project_id={project_id}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_api_client.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add backend/telegram_bot/ backend/tests/test_api_client.py
git commit -m "feat(backend): add Telegram bot API client library"
```

---

## Task 16: Full Test Suite Run + .gitignore

**Files:**
- Modify: `.gitignore` (at project root)

- [ ] **Step 1: Update .gitignore**

Add to the project root `.gitignore`:

```
# Backend
backend/keys/
*.pem
__pycache__/
*.pyc
.pytest_cache/
.coverage
```

- [ ] **Step 2: Run the full test suite**

Run: `python -m pytest backend/tests/ -v --tb=short`
Expected: ALL tests pass (approximately 20+ tests across all test files)

- [ ] **Step 3: Run linter**

Run: `cd backend && python -m ruff check .`
Expected: No errors (fix any issues that come up)

Run: `cd backend && python -m ruff format --check .`
Expected: All files formatted (run `ruff format .` to fix if needed)

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: update gitignore for backend keys and Python artifacts"
```

---

## Summary

| Task | What it delivers | Test count |
|------|-----------------|------------|
| 1 | Config module + scaffolding + pyproject.toml | 2 |
| 2 | Database + User model + Alembic | 2 |
| 3 | bcrypt password hashing | 3 |
| 4 | JWT RS256 token utilities | 4 |
| 5 | Auth Pydantic schemas + validation tests | 5 |
| 6 | Auth routes (register/login/refresh) | 7 |
| 7 | Auth dependency + /auth/me | 3 |
| 8 | Project, MediaAsset, Job models | 3 |
| 9 | Security headers + HSTS + CORS + rate limiting | 3 |
| 10 | R2 presigned URL client | 3 |
| 11 | Celery + Redis job queue | 2 |
| 12 | Jobs + Projects API routes | 3 |
| 13 | Docker (API + worker + Postgres + Redis) | 0 (infra) |
| 14 | CI/CD GitHub Actions | 0 (infra) |
| 15 | Telegram bot API client | 3 |
| 16 | Full suite + lint + gitignore | 0 (verification) |
| **Total** | | **~43 tests** |
