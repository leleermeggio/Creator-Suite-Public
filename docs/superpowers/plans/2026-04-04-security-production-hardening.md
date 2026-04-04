# Security Hardening & Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 confirmed exploits, plug all bug gaps, and deploy Creator Zone to a home server at $0 cost with automatic HTTPS via Caddy + DuckDNS.

**Architecture:** FastAPI backend + Expo web frontend behind a Caddy reverse proxy. Docker Compose orchestrates all services. DuckDNS provides a free stable subdomain; Caddy auto-fetches and renews Let's Encrypt TLS certs via DNS-01 challenge. No cloud costs during beta.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy / Alembic / Celery / Redis / PostgreSQL / Docker Compose / Caddy 2 / DuckDNS / TypeScript / Expo

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/migrations/versions/1cd136f2d91c_add_agents_and_missions.py` | Modify | Add CREATE TABLE for agents + missions |
| `backend/routes/captions.py` | Modify | Wire translate endpoint to real service |
| `backend/models/enums.py` | Modify | Add WATERMARK job type |
| `backend/routes/watermark.py` | Modify | Use WATERMARK job type |
| `backend/auth/schemas.py` | Modify | Restore EmailStr on LoginRequest |
| `backend/utils/url_safety.py` | Create | Shared SSRF protection utility |
| `backend/routes/tools.py` | Modify | Apply SSRF guard + disable follow_redirects |
| `backend/schemas/media.py` | Modify | Add field_validator for SSRF guard |
| `backend/routes/thumbnails.py` | Modify | Add asset ownership check (IDOR fix) |
| `backend/workers/tasks.py` | Modify | Add user_id filter in _get_asset_key |
| `backend/middleware/security.py` | Modify | Add missing security headers |
| `backend/middleware/rate_limit.py` | Modify | Add per-user key function |
| `backend/routes/jobs.py` | Modify | Add rate limit decorator |
| `backend/routes/missions.py` | Modify | Add rate limit decorator |
| `backend/routes/media.py` | Modify | Add rate limit decorator |
| `backend/routes/tools.py` | Modify | Add rate limit decorator |
| `backend/routes/agents.py` | Modify | Add rate limit decorator |
| `backend/routes/tools_analyze.py` | Modify | Mask exception detail in error response |
| `backend/routes/health.py` | Modify | Add DB + Redis health checks |
| `backend/.gitignore` | Modify | Add backend/keys/ |
| `docker-compose.yml` | Modify | Add Caddy + migrate service + log rotation + restart policies |
| `Caddyfile` | Create | Routing + auto-HTTPS config |
| `caddy.Dockerfile` | Create | Custom Caddy build with DuckDNS plugin |
| `backend/.env.production.example` | Create | Document all production env vars |
| `creatorzone.service` | Create | Systemd unit for auto-start on reboot |
| `frontend/services/apiClient.ts` | Modify | Read API base from EXPO_PUBLIC_API_URL |
| `frontend/.env.production` | Create | Production env vars for frontend |
| `backend/tests/utils/test_url_safety.py` | Create | Tests for the SSRF utility |
| `backend/tests/routes/test_thumbnails_idor.py` | Create | Tests for IDOR fix |

---

## Session 1 — Critical Bug Fixes

### Task 1: Fix Empty Migration (Agents + Missions Tables)

**Files:**
- Modify: `backend/migrations/versions/1cd136f2d91c_add_agents_and_missions.py`

- [ ] **Step 1: Open the migration file** — confirm both `upgrade()` and `downgrade()` are empty (`pass` only).

- [ ] **Step 2: Replace upgrade() and downgrade() with the correct table definitions**

```python
def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("steps", sa.JSON(), nullable=True),
        sa.Column("default_mode", sa.String(20), nullable=False, server_default="COPILOTA"),
        sa.Column("target_platforms", sa.JSON(), nullable=True),
        sa.Column("is_preset", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("preset_id", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_agents_user_id", "agents", ["user_id"])

    op.create_table(
        "missions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "agent_id",
            sa.String(36),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("current_step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mode", sa.String(20), nullable=False, server_default="COPILOTA"),
        sa.Column("step_results", sa.JSON(), nullable=True),
        sa.Column("insights", sa.JSON(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_missions_agent_id", "missions", ["agent_id"])
    op.create_index("ix_missions_project_id", "missions", ["project_id"])
    op.create_index("ix_missions_user_id", "missions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_missions_user_id", table_name="missions")
    op.drop_index("ix_missions_project_id", table_name="missions")
    op.drop_index("ix_missions_agent_id", table_name="missions")
    op.drop_table("missions")
    op.drop_index("ix_agents_user_id", table_name="agents")
    op.drop_table("agents")
```

- [ ] **Step 3: Run the migration against SQLite (dev)**

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade bf665d623b0b -> 1cd136f2d91c, add_agents_and_missions`

- [ ] **Step 4: Verify tables exist**

```bash
python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    engine = create_async_engine('sqlite+aiosqlite:///./creator_suite_dev.db')
    async with engine.connect() as conn:
        for table in ['agents', 'missions']:
            r = await conn.execute(text(f\"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'\"))
            print(table, ':', r.scalar())

asyncio.run(check())
"
```

Expected output:
```
agents : agents
missions : missions
```

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/versions/1cd136f2d91c_add_agents_and_missions.py
git commit -m "fix(db): fill empty migration — create agents and missions tables"
```

---

### Task 2: Fix Caption Translation Stub

**Files:**
- Modify: `backend/routes/captions.py:155-172`

- [ ] **Step 1: Locate the stub** — open `backend/routes/captions.py`, find the `translate_caption` function around line 141. The line `segments=source.segments,  # Placeholder` copies source segments without translating.

- [ ] **Step 2: Replace the stub with a real translation call**

Replace the entire `translate_caption` function body (from the DB query down to the `return`) with:

```python
async def translate_caption(
    caption_id: str,
    body: TranslateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Translate caption to target language. Creates a new Caption record with translated segments."""
    result = await db.execute(
        select(Caption).where(Caption.id == caption_id, Caption.user_id == user.id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Caption not found")

    from backend.services.translation_service import translate_segments

    try:
        translated_segments = await translate_segments(
            source.segments or [], body.target_language
        )
    except Exception:
        logger.error("❌ Translation failed for caption %s", caption_id, exc_info=True)
        raise HTTPException(status_code=502, detail="Translation service unavailable")

    translated = Caption(
        project_id=source.project_id,
        user_id=user.id,
        asset_id=source.asset_id,
        language=body.target_language,
        segments=translated_segments,
        style_preset=source.style_preset,
        font_family=source.font_family,
        font_size=source.font_size,
        color=source.color,
        bg_color=source.bg_color,
        position=source.position,
    )
    db.add(translated)
    await db.commit()
    await db.refresh(translated)
    return translated
```

- [ ] **Step 3: Verify `translate_segments` exists in the service**

```bash
grep -n "def translate_segments" backend/services/translation_service.py
```

Expected: line with `async def translate_segments(` or `def translate_segments(`. If it's sync, wrap in `asyncio.to_thread` instead of direct `await`.

- [ ] **Step 4: If translate_segments is sync, update the call**

Check the signature. If sync:
```python
import asyncio
translated_segments = await asyncio.to_thread(
    translate_segments, source.segments or [], body.target_language
)
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/captions.py
git commit -m "fix(captions): wire translate endpoint to real translation service"
```

---

### Task 3: Fix Watermark JobType

**Files:**
- Modify: `backend/models/enums.py`
- Modify: `backend/routes/watermark.py`

- [ ] **Step 1: Add WATERMARK to the JobType enum** in `backend/models/enums.py`

```python
class JobType(str, enum.Enum):
    TRANSCRIBE = "transcribe"
    JUMPCUT = "jumpcut"
    EXPORT = "export"
    CAPTION = "caption"
    AUDIO_CLEANUP = "audio_cleanup"
    SMART_SEARCH = "smart_search"
    THUMBNAIL = "thumbnail"
    WATERMARK = "watermark"   # ← add this line
    DOWNLOAD = "download"
    CONVERT = "convert"
    TTS = "tts"
    TRANSLATE = "translate"
```

- [ ] **Step 2: Update both watermark route handlers** in `backend/routes/watermark.py`

In `add_image_watermark`, change:
```python
type=JobType.THUMBNAIL,
```
to:
```python
type=JobType.WATERMARK,
```

In `add_text_watermark`, same change. Both occurrences are at lines ~60 and ~89.

- [ ] **Step 3: Verify no other file imports THUMBNAIL for watermark purposes**

```bash
grep -rn "JobType.THUMBNAIL" backend/
```

Expected: only thumbnail-related files, not watermark.

- [ ] **Step 4: Commit**

```bash
git add backend/models/enums.py backend/routes/watermark.py
git commit -m "fix(watermark): use JobType.WATERMARK instead of THUMBNAIL"
```

---

### Task 4: Restore Email Validation on LoginRequest

**Files:**
- Modify: `backend/auth/schemas.py`

- [ ] **Step 1: Change `email: str` to `email: EmailStr`** in `LoginRequest`

Current `backend/auth/schemas.py`:
```python
class LoginRequest(BaseModel):
    email: str        # ← wrong
    password: str
```

Replace with:
```python
class LoginRequest(BaseModel):
    email: EmailStr   # ← correct
    password: str
```

The `EmailStr` import is already at the top of the file.

- [ ] **Step 2: Verify the import is present**

```bash
head -5 backend/auth/schemas.py
```

Expected: `from pydantic import BaseModel, EmailStr, Field`

- [ ] **Step 3: Commit**

```bash
git add backend/auth/schemas.py
git commit -m "fix(auth): restore EmailStr validation on LoginRequest"
```

---

## Session 2 — Security Fixes (3 Confirmed Exploits)

### Task 5: Create SSRF URL Safety Utility

**Files:**
- Create: `backend/utils/__init__.py`
- Create: `backend/utils/url_safety.py`
- Create: `backend/tests/utils/test_url_safety.py`

- [ ] **Step 1: Create the utils package**

```bash
touch backend/utils/__init__.py
```

- [ ] **Step 2: Write the failing tests first**

Create `backend/tests/utils/test_url_safety.py`:

```python
from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.utils.url_safety import assert_safe_url


def test_valid_public_https_url_passes():
    assert_safe_url("https://example.com/video.mp4")  # no exception


def test_valid_public_http_url_passes():
    assert_safe_url("http://example.com/video.mp4")  # no exception


def test_rejects_file_scheme():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("file:///etc/passwd")
    assert exc_info.value.status_code == 400


def test_rejects_ftp_scheme():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("ftp://example.com/file")
    assert exc_info.value.status_code == 400


def test_rejects_localhost():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://localhost:6379/")
    assert exc_info.value.status_code == 400


def test_rejects_loopback_ip():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://127.0.0.1:8000/internal")
    assert exc_info.value.status_code == 400


def test_rejects_rfc1918_10_block():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://10.0.0.1/metadata")
    assert exc_info.value.status_code == 400


def test_rejects_rfc1918_192_168_block():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://192.168.1.1/admin")
    assert exc_info.value.status_code == 400


def test_rejects_rfc1918_172_16_block():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://172.16.0.1/secret")
    assert exc_info.value.status_code == 400


def test_rejects_link_local():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.status_code == 400


def test_rejects_empty_string():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("")
    assert exc_info.value.status_code == 400


def test_rejects_no_host():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("https:///path/only")
    assert exc_info.value.status_code == 400
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/utils/test_url_safety.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — the module doesn't exist yet.

- [ ] **Step 4: Implement the utility**

Create `backend/utils/url_safety.py`:

```python
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException, status


def assert_safe_url(url: str) -> None:
    """Raise HTTP 400 if the URL could be used for SSRF.

    Rejects:
    - Non-http(s) schemes (file://, ftp://, etc.)
    - Missing or empty host
    - Private, loopback, and link-local IP ranges
    - Hostnames that resolve to private IPs
    """
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required",
        )

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only http and https URLs are allowed",
        )

    host = parsed.hostname
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must contain a valid host",
        )

    try:
        resolved_ip = socket.gethostbyname(host)
        addr = ipaddress.ip_address(resolved_ip)
    except (socket.gaierror, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve host or invalid address",
        )

    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requests to internal or private addresses are not allowed",
        )
```

- [ ] **Step 5: Run tests again — all should pass**

```bash
python -m pytest tests/utils/test_url_safety.py -v
```

Expected: 12 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/utils/__init__.py backend/utils/url_safety.py backend/tests/utils/test_url_safety.py
git commit -m "feat(security): add SSRF URL safety utility with tests"
```

---

### Task 6: Fix SSRF in Jumpcut Endpoint

**Files:**
- Modify: `backend/routes/tools.py:56-73`

- [ ] **Step 1: Add the import** at the top of `backend/routes/tools.py`, after the existing imports:

```python
from backend.utils.url_safety import assert_safe_url
```

- [ ] **Step 2: Add the safety check and disable follow_redirects** — in the `jumpcut` function, locate the `if url:` block (around line 56). Replace:

```python
        if url:
            logger.info("Downloading from URL: %s", url)
            # Add browser-like headers to bypass anti-bot protection
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": url.rsplit("/", 1)[0] + "/",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
            async with httpx.AsyncClient(
                timeout=300.0, follow_redirects=True
            ) as client:
```

With:

```python
        if url:
            assert_safe_url(url)
            logger.info("Downloading from URL: %s", url)
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
            }
            async with httpx.AsyncClient(
                timeout=300.0, follow_redirects=False
            ) as client:
```

Note: the `Referer` header is removed (it was being set to a derivative of the attacker-controlled URL).

- [ ] **Step 3: Verify the change compiles**

```bash
python -c "from backend.routes.tools import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/tools.py
git commit -m "fix(security): patch SSRF in jumpcut endpoint — validate URL + disable redirects"
```

---

### Task 7: Fix SSRF in Media Import-URL Schema

**Files:**
- Modify: `backend/schemas/media.py:29-31`

- [ ] **Step 1: Add import** at the top of `backend/schemas/media.py`:

```python
from pydantic import BaseModel, Field, field_validator
from backend.utils.url_safety import assert_safe_url
```

Replace the existing `from pydantic import BaseModel, Field` import with the line above.

- [ ] **Step 2: Add the validator to ImportURLRequest**

Replace:
```python
class ImportURLRequest(BaseModel):
    project_id: str
    url: str = Field(min_length=1, max_length=2048)
```

With:
```python
class ImportURLRequest(BaseModel):
    project_id: str
    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url")
    @classmethod
    def url_must_be_safe(cls, v: str) -> str:
        assert_safe_url(v)
        return v
```

- [ ] **Step 3: Verify the schema loads**

```bash
python -c "from backend.schemas.media import ImportURLRequest; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/schemas/media.py
git commit -m "fix(security): patch SSRF in media import-url — validate URL in schema"
```

---

### Task 8: Fix IDOR in Extract Frame Route

**Files:**
- Modify: `backend/routes/thumbnails.py:50-82`
- Create: `backend/tests/routes/test_thumbnails_idor.py`

- [ ] **Step 1: Write failing IDOR test**

Create `backend/tests/routes/test_thumbnails_idor.py`:

```python
from __future__ import annotations

import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.media_asset import MediaAsset


@pytest.mark.asyncio
async def test_extract_frame_rejects_asset_from_other_user(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    other_user_asset_id: str,
    own_project_id: str,
):
    """User A cannot extract frames from User B's asset."""
    response = await client.post(
        "/thumbnails/extract-frame",
        json={
            "project_id": own_project_id,
            "asset_id": other_user_asset_id,  # belongs to a different user
            "timestamp": 5.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


@pytest.mark.asyncio
async def test_extract_frame_rejects_asset_from_other_project(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    own_asset_in_other_project_id: str,
    own_project_id: str,
):
    """User cannot use an asset from a different project even if they own it."""
    response = await client.post(
        "/thumbnails/extract-frame",
        json={
            "project_id": own_project_id,
            "asset_id": own_asset_in_other_project_id,
            "timestamp": 5.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Add ownership check in extract_frame route**

In `backend/routes/thumbnails.py`, add `MediaAsset` import at the top:
```python
from backend.models.media_asset import MediaAsset
```

In the `extract_frame` function, after `await _verify_project_access(body.project_id, user, db)` and before creating the Thumbnail, add:

```python
    # Verify the asset belongs to this user AND this project (prevents IDOR)
    asset_result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == body.asset_id,
            MediaAsset.user_id == user.id,
            MediaAsset.project_id == body.project_id,
        )
    )
    if not asset_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")
```

- [ ] **Step 3: Verify the route compiles**

```bash
python -c "from backend.routes.thumbnails import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/thumbnails.py backend/tests/routes/test_thumbnails_idor.py
git commit -m "fix(security): patch IDOR in extract-frame — verify asset ownership before enqueue"
```

---

### Task 9: Fix IDOR in Celery Worker (Defense-in-Depth)

**Files:**
- Modify: `backend/routes/thumbnails.py:71-81` (add user_id to input_params)
- Modify: `backend/workers/tasks.py:353-362` (add user_id filter to DB query)

- [ ] **Step 1: Pass user_id in the Celery task input_params**

In `backend/routes/thumbnails.py`, in the `extract_frame` function, update the `process_job.delay()` call:

```python
    process_job.delay(
        job_id=thumb.id,
        job_type="thumbnail",
        input_params={
            "action": "extract_frame",
            "asset_id": body.asset_id,
            "timestamp": body.timestamp,
            "project_id": body.project_id,
            "user_id": user.id,   # ← add this
        },
    )
```

- [ ] **Step 2: Add user_id filter in _get_asset_key inside the worker**

In `backend/workers/tasks.py`, find the `_get_asset_key` nested async function (around line 353). Replace:

```python
            async def _get_asset_key() -> str | None:
                s = get_settings()
                engine = create_async_engine(s.DATABASE_URL)
                async_session = async_sessionmaker(engine, expire_on_commit=False)
                async with async_session() as session:
                    result = await session.execute(
                        select(MediaAsset).where(MediaAsset.id == asset_id)
                    )
                    asset = result.scalar_one_or_none()
                    return asset.storage_key if asset else None
```

With:

```python
            async def _get_asset_key() -> str | None:
                s = get_settings()
                engine = create_async_engine(s.DATABASE_URL)
                async_session = async_sessionmaker(engine, expire_on_commit=False)
                async with async_session() as session:
                    filters = [MediaAsset.id == asset_id]
                    if user_id := input_params.get("user_id"):
                        filters.append(MediaAsset.user_id == user_id)
                    result = await session.execute(
                        select(MediaAsset).where(*filters)
                    )
                    asset = result.scalar_one_or_none()
                    return asset.storage_key if asset else None
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/thumbnails.py backend/workers/tasks.py
git commit -m "fix(security): defense-in-depth IDOR fix in Celery worker — filter asset by user_id"
```

---

## Session 3 — Security Hardening

### Task 10: Improve Security Headers Middleware

**Files:**
- Modify: `backend/middleware/security.py`

- [ ] **Step 1: View the current middleware** — it already sets 4 headers. We need to add `Referrer-Policy`, `Permissions-Policy`, and a lean CSP.

- [ ] **Step 2: Replace the middleware with the hardened version**

```python
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        response.headers["X-Request-ID"] = str(uuid.uuid4())
        response.headers["Cache-Control"] = "no-store"
        return response
```

- [ ] **Step 3: Verify middleware loads**

```bash
python -c "from backend.middleware.security import SecurityHeadersMiddleware; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/middleware/security.py
git commit -m "fix(security): add Referrer-Policy, Permissions-Policy, CSP headers"
```

---

### Task 11: Add Per-User Rate Limiting to Sensitive Endpoints

**Files:**
- Modify: `backend/middleware/rate_limit.py`
- Modify: `backend/routes/jobs.py`
- Modify: `backend/routes/missions.py`
- Modify: `backend/routes/media.py`
- Modify: `backend/routes/tools.py`
- Modify: `backend/routes/agents.py`

- [ ] **Step 1: Add a per-user key function to the limiter module**

Replace `backend/middleware/rate_limit.py` with:

```python
from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_user_or_ip(request: Request) -> str:
    """Rate limit by user_id (from JWT state) or fall back to IP."""
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    return get_remote_address(request)


limiter = Limiter(key_func=_get_user_or_ip)
```

- [ ] **Step 2: Add rate limit to POST /jobs**

In `backend/routes/jobs.py`, import `limiter` and `Request` if not already imported:
```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
from backend.middleware.rate_limit import limiter
```

On the `create_job` route handler, add the decorator:
```python
@router.post("/", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("30/minute")
async def create_job(request: Request, body: JobCreate, ...):
```

- [ ] **Step 3: Add rate limit to POST /missions/{id}/execute**

In `backend/routes/missions.py`, add `Request` to FastAPI import and import limiter:
```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
from backend.middleware.rate_limit import limiter
```

Find the `execute_step` handler and add:
```python
@router.post("/{mission_id}/steps/{step_index}/execute")
@limiter.limit("20/minute")
async def execute_step(request: Request, mission_id: str, step_index: int, ...):
```

- [ ] **Step 4: Add rate limit to POST /media/import-url**

In `backend/routes/media.py`, add `Request` and limiter import, then decorate `import_from_url`:
```python
@router.post("/import-url", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def import_from_url(request: Request, body: ImportURLRequest, ...):
```

- [ ] **Step 5: Add rate limit to POST /tools/jumpcut and POST /tools/analyze-media**

In `backend/routes/tools.py`, add limiter import and decorate:
```python
@router.post("/jumpcut")
@limiter.limit("20/minute")
async def jumpcut(request: Request, ...):
```

In `backend/routes/tools_analyze.py`:
```python
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from backend.middleware.rate_limit import limiter

@router.post("/analyze-media")
@limiter.limit("20/minute")
async def analyze_media(request: Request, ...):
```

- [ ] **Step 6: Add rate limit to POST /agents/generate (Gemini calls)**

In `backend/routes/agents.py`, add limiter and decorate generate endpoint:
```python
@router.post("/generate")
@limiter.limit("5/minute")
async def generate_agent(request: Request, ...):
```

- [ ] **Step 7: Verify all routes still load**

```bash
python -c "
from backend.routes.jobs import router
from backend.routes.missions import router as mr
from backend.routes.media import router as med
from backend.routes.tools import router as t
from backend.routes.agents import router as a
print('All routers OK')
"
```

Expected: `All routers OK`

- [ ] **Step 8: Commit**

```bash
git add backend/middleware/rate_limit.py backend/routes/jobs.py backend/routes/missions.py backend/routes/media.py backend/routes/tools.py backend/routes/tools_analyze.py backend/routes/agents.py
git commit -m "feat(security): add per-user rate limiting to all write/compute endpoints"
```

---

### Task 12: Mask Exception Details in Error Responses

**Files:**
- Modify: `backend/routes/tools_analyze.py:55-60`

- [ ] **Step 1: Replace the leaking error detail**

Find the `except Exception as exc:` block in `backend/routes/tools_analyze.py`:

```python
    except Exception as exc:
        logger.error("❌ Media analysis failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {exc}",   # ← leaks internal detail
        )
```

Replace with:

```python
    except Exception:
        logger.error("❌ Media analysis failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Media analysis failed",
        )
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/tools_analyze.py
git commit -m "fix(security): mask internal exception details in analyze-media error response"
```

---

### Task 13: Add JWT Keys to .gitignore

**Files:**
- Modify: `backend/.gitignore` (create if missing)

- [ ] **Step 1: Check if .gitignore exists at backend level**

```bash
ls backend/.gitignore 2>/dev/null && echo "exists" || echo "missing"
```

- [ ] **Step 2: If missing, create it. If exists, append.**

```bash
echo "keys/" >> backend/.gitignore
echo "*.pem" >> backend/.gitignore
echo ".env.production" >> backend/.gitignore
```

- [ ] **Step 3: Verify keys/ is now ignored**

```bash
git check-ignore -v backend/keys/private.pem
```

Expected: `backend/.gitignore:1:keys/	backend/keys/private.pem`

If the files are already tracked (committed), remove them from tracking:
```bash
git rm --cached backend/keys/private.pem backend/keys/public.pem
```

- [ ] **Step 4: Document key generation in CLAUDE.md** — add to the Quick Start section:

```markdown
# Generate fresh JWT keys for production (never reuse dev keys)
cd backend/keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

- [ ] **Step 5: Commit**

```bash
git add backend/.gitignore CLAUDE.md
git commit -m "chore(security): add keys/ to .gitignore and document key generation"
```

---

### Task 13b: Add Request Size Limits

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Check if ContentSizeLimitMiddleware is available**

```bash
python -c "from starlette.middleware.sizefull import ContentSizeLimitMiddleware; print('OK')" 2>/dev/null || echo "not in starlette — use custom"
```

If the import fails, use this inline middleware instead.

- [ ] **Step 2: Add request size limit middleware to main.py**

In `backend/main.py`, after the `SecurityHeadersMiddleware` line inside `create_app`, add:

```python
    # Limit request body size: 500MB for all routes.
    # Individual media upload routes enforce their own Pydantic size limits.
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import Response as StarletteResponse

    class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
        MAX_BYTES = 500 * 1024 * 1024  # 500 MB

        async def dispatch(self, request, call_next):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.MAX_BYTES:
                return StarletteResponse(
                    content='{"detail":"Request body too large"}',
                    status_code=413,
                    media_type="application/json",
                )
            return await call_next(request)

    app.add_middleware(RequestSizeLimitMiddleware)
```

- [ ] **Step 3: Verify app still starts**

```bash
python -c "
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
engine = create_async_engine('sqlite+aiosqlite:///./test_tmp.db')
factory = async_sessionmaker(engine)
from backend.main import create_app
app = create_app(factory)
print('OK')
import os; os.remove('test_tmp.db')
"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(security): add 500MB request size limit middleware"
```

---

### Task 13c: Lock CORS to Production Domain

**Files:**
- Modify: `backend/main.py`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Remove the private-IP allow_origin_regex from CORSMiddleware**

In `backend/main.py`, find the `CORSMiddleware` block:

```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_origin_regex=(
            r"http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
            r":(8081|19006|3000|8000)"
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

Replace with:

```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

The `allow_origin_regex` that allowed all private-IP ranges is removed. Production origins are set via `ALLOWED_ORIGINS` env var.

- [ ] **Step 2: Set production ALLOWED_ORIGINS in docker-compose.yml**

In `docker-compose.yml`, update the `api` service environment to require the DuckDNS URLs:

```yaml
    environment:
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://app.creatorzone.duckdns.org,https://api.creatorzone.duckdns.org}
```

Replace the existing `ALLOWED_ORIGINS` line with this. In the `.env.production.example`, `ALLOWED_ORIGINS` is already set to the real DuckDNS URLs.

- [ ] **Step 3: Verify app starts**

```bash
python -c "
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
engine = create_async_engine('sqlite+aiosqlite:///./test_tmp.db')
factory = async_sessionmaker(engine)
from backend.main import create_app
app = create_app(factory)
print('OK')
import os; os.remove('test_tmp.db')
"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py docker-compose.yml
git commit -m "fix(security): remove private-IP CORS wildcard, lock origins to env-configured domains"
```

---

## Session 4 — Home Server Production Setup

### Task 14: Add Migration Service + Restart Policies to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add `restart: unless-stopped` to api, worker, frontend, postgres, redis**

In `docker-compose.yml`, add `restart: unless-stopped` to each service that's missing it. The `creatorzone-bot` already has it.

After each service's `build:` or `image:` line, add:
```yaml
    restart: unless-stopped
```

- [ ] **Step 2: Add Docker log rotation to all services**

Under each service, add:
```yaml
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

- [ ] **Step 3: Add the migrate one-shot service**

Add this service before the `api` service:

```yaml
  # ── DB Migration (runs once on deploy, exits) ─────────────────────────────
  migrate:
    build: ./backend
    command: alembic upgrade head
    env_file: ./backend/.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://creator:creator@postgres:5432/creator_suite
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

- [ ] **Step 4: Make api depend on migrate completing**

In the `api` service `depends_on` block, add:
```yaml
    depends_on:
      migrate:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

- [ ] **Step 5: Verify the compose file parses**

```bash
docker compose config --quiet && echo "OK"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): add migrate service, restart policies, log rotation to docker-compose"
```

---

### Task 15: Add Caddy Reverse Proxy with Auto-HTTPS

**Files:**
- Create: `caddy.Dockerfile`
- Create: `Caddyfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create custom Caddy Dockerfile with DuckDNS plugin**

Create `caddy.Dockerfile` at the project root:

```dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/caddy-dns/duckdns

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

- [ ] **Step 2: Create Caddyfile**

Create `Caddyfile` at the project root:

```caddyfile
# Replace YOUR_SUBDOMAIN with your actual DuckDNS name (e.g. creatorzone)
# Full domain: creatorzone.duckdns.org

api.{$DUCKDNS_DOMAIN} {
    reverse_proxy api:8000

    tls {
        dns duckdns {$DUCKDNS_TOKEN}
    }

    header {
        # Remove Caddy's "Server" header
        -Server
    }

    log {
        output stdout
        format json
        level INFO
    }
}

app.{$DUCKDNS_DOMAIN} {
    reverse_proxy frontend:8081

    tls {
        dns duckdns {$DUCKDNS_TOKEN}
    }

    header {
        -Server
    }

    log {
        output stdout
        format json
        level INFO
    }
}
```

- [ ] **Step 3: Add the Caddy service to docker-compose.yml**

In the services section (after the `redis` service):

```yaml
  # ── Caddy Reverse Proxy (auto-HTTPS via DuckDNS) ──────────────────────────
  caddy:
    build:
      context: .
      dockerfile: caddy.Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      - DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN}
      - DUCKDNS_TOKEN=${DUCKDNS_TOKEN}
    depends_on:
      - api
      - frontend
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

- [ ] **Step 4: Add caddy_data and caddy_config to the volumes section**

At the bottom of `docker-compose.yml`, the `volumes:` block should become:

```yaml
volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 5: Remove host port bindings from api and frontend** (Caddy is now the public face)

In the `api` service, change:
```yaml
    ports:
      - "127.0.0.1:8000:8000"
```
to: *(remove the ports section entirely — api is only reachable from within Docker)*

In the `frontend` service, change:
```yaml
    ports:
      - "127.0.0.1:8081:8081"
```
to: *(remove the ports section entirely)*

- [ ] **Step 6: Verify compose parses**

```bash
docker compose config --quiet && echo "OK"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add caddy.Dockerfile Caddyfile docker-compose.yml
git commit -m "feat(infra): add Caddy reverse proxy with DuckDNS auto-HTTPS"
```

---

### Task 16: Create Production Environment Template and Systemd Unit

**Files:**
- Create: `backend/.env.production.example`
- Create: `creatorzone.service`
- Create: `docs/deployment/home-server.md`

- [ ] **Step 1: Create the production env example**

Create `backend/.env.production.example`:

```bash
# Creator Zone — Production Environment Variables
# Copy this to backend/.env and fill in real values before running docker compose

# ── Database ──────────────────────────────────────────────────────────────────
# Override in docker-compose.yml to use docker service name (postgres:5432)
DATABASE_URL=postgresql+asyncpg://creator:CHANGE_ME@localhost:5432/creator_suite

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://:CHANGE_ME@localhost:6379/0

# ── JWT Keys ──────────────────────────────────────────────────────────────────
# Generate fresh keys: see CLAUDE.md Quick Start
JWT_PRIVATE_KEY_PATH=backend/keys/private.pem
JWT_PUBLIC_KEY_PATH=backend/keys/public.pem

# ── CORS ──────────────────────────────────────────────────────────────────────
# Set to your actual DuckDNS URLs — no trailing slashes
ALLOWED_ORIGINS=https://api.creatorzone.duckdns.org,https://app.creatorzone.duckdns.org

# ── Redis password (must match docker-compose.yml) ────────────────────────────
REDIS_PASSWORD=CHANGE_ME

# ── Cloudflare R2 ─────────────────────────────────────────────────────────────
R2_ENDPOINT_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=CHANGE_ME
R2_SECRET_ACCESS_KEY=CHANGE_ME
R2_BUCKET_NAME=creator-zone-media

# ── Google Gemini AI ──────────────────────────────────────────────────────────
GOOGLE_API_KEY=CHANGE_ME

# ── DuckDNS (for Caddy TLS) ───────────────────────────────────────────────────
DUCKDNS_DOMAIN=creatorzone.duckdns.org
DUCKDNS_TOKEN=CHANGE_ME

# ── PostgreSQL (used by docker-compose) ───────────────────────────────────────
POSTGRES_USER=creator
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=creator_suite
```

- [ ] **Step 2: Create the systemd unit file**

Create `creatorzone.service`:

```ini
[Unit]
Description=Creator Zone Docker Compose Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/creatorzone
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Create the deployment guide**

Create `docs/deployment/home-server.md`:

```markdown
# Home Server Deployment Guide

## Prerequisites
- Docker + Docker Compose installed
- Ports 80 and 443 open on your router and forwarded to this machine
- A DuckDNS account and subdomain registered at https://www.duckdns.org

## First-Time Setup

### 1. Clone and configure
```bash
git clone <repo-url> /opt/creatorzone
cd /opt/creatorzone
cp backend/.env.production.example backend/.env
```

Edit `backend/.env` — fill in all `CHANGE_ME` values.

### 2. Generate JWT keys
```bash
mkdir -p backend/keys
cd backend/keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
cd ../..
```

### 3. Set DuckDNS IP (run once, then set up cron)
```bash
curl "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip="
```

Auto-update every 5 minutes — add to crontab:
```bash
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" > /dev/null
```

### 4. Start the stack
```bash
docker compose up -d
```

Wait ~60 seconds for Caddy to obtain TLS certs from Let's Encrypt.

### 5. Verify
```bash
curl https://api.creatorzone.duckdns.org/health
# Expected: {"status":"ok","db":"ok","redis":"ok"}
```

### 6. Enable auto-start on reboot
```bash
sudo cp creatorzone.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable creatorzone
sudo systemctl start creatorzone
```

## Updating
```bash
cd /opt/creatorzone
git pull
docker compose up -d --build
```
The `migrate` service runs automatically and applies any new migrations.

## Seed dev user (first run only)
```bash
docker compose exec api python -m backend.seeds.dev_user
```
```

- [ ] **Step 4: Commit**

```bash
git add backend/.env.production.example creatorzone.service docs/deployment/home-server.md
git commit -m "feat(infra): add production env template, systemd unit, deployment guide"
```

---

## Session 5 — Observability

### Task 17: Improve Health Endpoint

**Files:**
- Modify: `backend/routes/health.py`

- [ ] **Step 1: Replace the bare health check with a real one**

```python
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
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
        import os
        import redis.asyncio as aioredis

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = aioredis.from_url(redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        redis_ok = True
    except Exception:
        logger.error("❌ Health check: Redis unreachable", exc_info=True)

    status_code = 200 if (db_ok and redis_ok) else 503
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if (db_ok and redis_ok) else "degraded",
            "db": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        },
    )
```

- [ ] **Step 2: Ensure redis package is in requirements**

```bash
grep -i "redis" backend/requirements.txt
```

Expected: a line like `redis>=5.0` or `redis[asyncio]`. If missing, add:
```bash
echo "redis[asyncio]>=5.0" >> backend/requirements.txt
```

- [ ] **Step 3: Verify the route loads**

```bash
python -c "from backend.routes.health import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Update Docker Compose healthcheck for api service**

In `docker-compose.yml`, add a healthcheck to the `api` service:

```yaml
  api:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/health.py docker-compose.yml
git commit -m "feat(observability): deep health check for DB + Redis, add api healthcheck to compose"
```

---

### Task 18: Add Structured JSON Logging

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add logging configuration to create_app**

In `backend/main.py`, add this import at the top:
```python
import logging
import logging.config
```

At the very beginning of `create_app()`, before `settings = get_settings()`, add:

```python
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
            },
        },
        "handlers": {
            "stdout": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "json",
            },
        },
        "root": {
            "level": "INFO",
            "handlers": ["stdout"],
        },
        "loggers": {
            "uvicorn": {"level": "INFO"},
            "sqlalchemy.engine": {"level": "WARNING"},
            "celery": {"level": "INFO"},
        },
    })
```

- [ ] **Step 2: Verify app still creates without error**

```bash
python -c "
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
engine = create_async_engine('sqlite+aiosqlite:///./test_tmp.db')
factory = async_sessionmaker(engine)
from backend.main import create_app
app = create_app(factory)
print('App created OK')
import os; os.remove('test_tmp.db')
"
```

Expected: `App created OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(observability): add structured stdout logging configuration"
```

---

## Session 6 — Frontend

### Task 19: Read API Base URL from Environment Variable

**Files:**
- Modify: `frontend/services/apiClient.ts`
- Create: `frontend/.env.production`
- Create: `frontend/.env.development`

- [ ] **Step 1: Update apiClient.ts to prefer env var**

Replace the `resolveApiBase` function and `API_BASE` constant at the top of `frontend/services/apiClient.ts`:

```typescript
function resolveApiBase(): string {
  // Prefer explicit env var (set in .env.production or .env.development)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Web: use same host as the app, port 8000
  if (typeof window !== 'undefined' && window?.location?.hostname) {
    const { hostname, protocol } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
}

export const API_BASE = resolveApiBase();
```

- [ ] **Step 2: Create .env.development**

Create `frontend/.env.development`:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

- [ ] **Step 3: Create .env.production**

Create `frontend/.env.production`:

```bash
EXPO_PUBLIC_API_URL=https://api.creatorzone.duckdns.org
```

- [ ] **Step 4: Add both env files to frontend .gitignore** (`.env.production` contains real URLs)

```bash
echo ".env.production" >> frontend/.gitignore
echo ".env.local" >> frontend/.gitignore
```

Add `.env.production.example`:
```bash
cp frontend/.env.production frontend/.env.production.example
```

Then edit `.env.production.example` to replace the real URL with a placeholder:
```bash
EXPO_PUBLIC_API_URL=https://api.YOUR_SUBDOMAIN.duckdns.org
```

- [ ] **Step 5: Verify TypeScript still compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/.env.development frontend/.env.production.example frontend/.gitignore
git commit -m "feat(frontend): read API base URL from EXPO_PUBLIC_API_URL env var"
```

---

## Session 7 — Integration Verification

### Task 20: Full Stack Smoke Test

This session is run by a **code-reviewer + security-auditor** agent pair after all prior tasks are complete.

- [ ] **Step 1: Start the full stack**

```bash
docker compose up -d
```

Wait 60 seconds for services to be healthy and Caddy to obtain certs.

- [ ] **Step 2: Run migration verification**

```bash
docker compose logs migrate
```

Expected: `Running upgrade bf665d623b0b -> 1cd136f2d91c` in output and exit code 0.

- [ ] **Step 3: Health check**

```bash
curl -s https://api.creatorzone.duckdns.org/health | python -m json.tool
```

Expected:
```json
{"status": "ok", "db": "ok", "redis": "ok"}
```

- [ ] **Step 4: Verify security headers**

```bash
curl -sI https://api.creatorzone.duckdns.org/health | grep -E "X-Frame|X-Content|Strict|Referrer|Permissions|Content-Security"
```

Expected: all 6 headers present.

- [ ] **Step 5: Verify SSRF is blocked**

```bash
curl -s -X POST https://api.creatorzone.duckdns.org/media/import-url \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test", "url": "http://127.0.0.1:5432/"}'
```

Expected: `{"detail": "Requests to internal or private addresses are not allowed"}` with status 400.

- [ ] **Step 6: Verify rate limiting**

```bash
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://api.creatorzone.duckdns.org/jobs/ \
    -H "Authorization: Bearer <test_token>" \
    -H "Content-Type: application/json" \
    -d '{}'
done
```

Expected: first 30 return 422 (validation error), last 5 return 429 (rate limited).

- [ ] **Step 7: Verify agents + missions tables exist**

```bash
docker compose exec api python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

async def check():
    engine = create_async_engine(os.environ['DATABASE_URL'])
    async with engine.connect() as conn:
        for table in ['agents', 'missions']:
            r = await conn.execute(text(f\"SELECT COUNT(*) FROM {table}\"))
            print(table, ':', r.scalar(), 'rows')

asyncio.run(check())
"
```

Expected:
```
agents : 0 rows
missions : 0 rows
```

- [ ] **Step 8: Seed dev user and test auth**

```bash
docker compose exec api python -m backend.seeds.dev_user
curl -s -X POST https://api.creatorzone.duckdns.org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@creatorzone.dev", "password": "CreatorZone2024!"}'
```

Expected: JSON with `access_token` and `refresh_token`.

- [ ] **Step 9: Commit final state**

```bash
git add -A
git commit -m "chore: production deployment verified — all security fixes + home server setup complete"
```

---

## Agent Assignment Guide

| Session | Tasks | Recommended Agent(s) | Notes |
|---|---|---|---|
| S1 — Bug Fixes | 1–4 | `backend-architect` | Sequential — migration must run before testing |
| S2 — Security Exploits | 5–9 | `security-auditor` + `backend-architect` | Start with Task 5 (utility), then 6–9 in parallel |
| S3 — Hardening | 10–13c | `backend-architect` | Can run in parallel after S2 |
| S4 — Infrastructure | 14–16 | `backend-architect` | Sequential — compose changes stack up |
| S5 — Observability | 17–18 | `backend-architect` | Independent of S4 |
| S6 — Frontend | 19 | `frontend-developer` | Independent — can run parallel with S3–S5 |
| S7 — Verification | 20 | `code-reviewer` + `security-auditor` | Must run after all other sessions complete |
