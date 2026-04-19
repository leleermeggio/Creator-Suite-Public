# Creator Zone — Security Hardening & Production Deployment Design
**Date:** 2026-04-04  
**Author:** Leo Partis  
**Status:** Approved  
**Phase:** Beta → Home Server ($0 budget)

---

## Context

Creator Zone is a FastAPI + React Native/Expo app with Celery workers, PostgreSQL, Redis, and Cloudflare R2. The immediate goal is a **home server beta deployment for 10–20 creators at $0 cost**, hardened against the 3 confirmed exploits found in the security audit. The architecture must upgrade cleanly to a cloud VPS when revenue permits.

---

## Deployment Stack (All Free)

| Layer | Tool | Cost |
|---|---|---|
| Container orchestration | Docker Compose (root) | Free |
| Reverse proxy + TLS | Caddy + Let's Encrypt | Free |
| Dynamic DNS | DuckDNS subdomain | Free |
| CDN / IP masking (later) | Cloudflare free plan | Free |
| DB | PostgreSQL 16 (Docker) | Free |
| Queue + cache | Redis 7 (Docker) | Free |
| Media storage | Cloudflare R2 (existing) | Free tier |

**Routing:**
- `api.creatorzone.duckdns.org` → FastAPI :8000
- `app.creatorzone.duckdns.org` → Expo web :8081

**Upgrade path:** Same Docker Compose moves to a Hetzner VPS (~€5/mo) when load demands it. Zero refactoring required.

---

## Section 1 — Critical Bug Fixes

These must ship before any user accesses the system.

### 1.1 Empty Migration (Agents + Missions tables)
- **File:** `backend/migrations/versions/1cd136f2d91c_add_agents_and_missions.py`
- **Fix:** Implement `upgrade()` with `op.create_table()` for `agents` and `missions` tables, matching models in `backend/models/agent.py` and `backend/models/mission.py`. Implement `downgrade()` with `op.drop_table()`.
- **Why:** Without this, `alembic upgrade head` creates no tables for agents/missions and the entire feature crashes at runtime.

### 1.2 Caption Translation Stub
- **File:** `backend/routes/captions.py:155`
- **Fix:** Wire `POST /captions/{id}/translate` to call `translation_service.translate_segments()`, persist updated segments to DB, return updated caption object.

### 1.3 Watermark JobType Mismatch
- **File:** `backend/routes/watermark.py:60,89`
- **Fix:** Add `WATERMARK_IMAGE` and `WATERMARK_TEXT` variants to the `JobType` enum, or map watermark routes to a correct existing type. Remove usage of `JobType.THUMBNAIL` for watermark jobs.

### 1.4 Login Email Validation
- **File:** `backend/auth/schemas.py`
- **Fix:** Change `LoginRequest.email` back to `EmailStr`. The change to `str` breaks consistency with registration validation.

---

## Section 2 — Security Fixes (3 Confirmed Exploits)

### 2.1 SSRF Utility (shared)
- **New file:** `backend/utils/url_safety.py`
- **Implements:** `assert_safe_url(url: str) -> None` — resolves hostname, rejects private/loopback/link-local IP ranges (RFC 1918, RFC 5735), rejects non-http(s) schemes, raises `HTTPException(400)`.
- **Used by:** items 2.2 and 2.3 below.

### 2.2 SSRF — Jumpcut Endpoint
- **File:** `backend/routes/tools.py:56`
- **Severity:** High
- **Fix:** Call `assert_safe_url(url)` before the `httpx.AsyncClient` fetch. Set `follow_redirects=False`.

### 2.3 SSRF — Media Import-URL
- **File:** `backend/schemas/media.py:29`
- **Severity:** High
- **Fix:** Add Pydantic `@field_validator("url")` on `ImportURLRequest` calling `assert_safe_url()`.

### 2.4 IDOR — Extract Frame (route)
- **File:** `backend/routes/thumbnails.py:50`
- **Severity:** High
- **Fix:** After verifying project ownership, query `MediaAsset` filtered by `id=body.asset_id AND user_id=user.id AND project_id=body.project_id`. Raise 404 if not found.

### 2.5 IDOR — Extract Frame (worker, defense-in-depth)
- **File:** `backend/workers/tasks.py:353`
- **Fix:** Pass `user_id` in `input_params` and add `user_id` filter to the `_get_asset_key()` DB query inside the Celery task.

---

## Section 3 — Security Hardening (Backend)

### 3.1 Security Headers Middleware
- **File:** `backend/main.py`
- **Add middleware** setting these headers on every response:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (added by Caddy but also set here)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy: default-src 'self'` (relaxed for API — no HTML served)

### 3.2 Per-Endpoint Rate Limiting
- **Extend slowapi** to cover write-heavy and compute-heavy endpoints:
  - `POST /jobs` — 30/min per user
  - `POST /missions/*/execute` — 20/min per user
  - `POST /media/import-url` — 10/min per user
  - `POST /tools/*` — 20/min per user
  - `POST /agents/generate` — 5/min per user (Gemini calls)
- Auth endpoints keep their existing 5/min limit.

### 3.3 Request Size Limits
- **File:** `backend/main.py`
- Add `ContentSizeLimitMiddleware`: 500MB for media upload routes, 1MB for JSON body routes.

### 3.4 CORS Locked to Production Domain
- **File:** `backend/main.py`, `backend/.env.production`
- Remove wildcard fallback. `ALLOWED_ORIGINS` in production `.env` set to exact DuckDNS URLs only.

### 3.5 JWT Keys Out of Git
- Add `backend/keys/` to `.gitignore`.
- Document key generation command in `README.md` and `CLAUDE.md`.
- Existing committed keys are dev-only; generate fresh keys on the server.

### 3.6 Sensitive Error Message Masking
- **File:** `backend/routes/tools_analyze.py:58` and any other `detail=f"...{exc}"` pattern
- Replace with generic: `detail="Internal processing error"`. Log the real exception server-side.

---

## Section 4 — Home Server Production Setup ($0)

### 4.1 Caddy Service in Docker Compose
- Add `caddy` service to root `docker-compose.yml`.
- Mount a `Caddyfile` that:
  - Routes `api.creatorzone.duckdns.org` → `http://api:8000`
  - Routes `app.creatorzone.duckdns.org` → `http://frontend:8081`
  - Handles TLS automatically via DuckDNS DNS-01 challenge (using `caddy-dns/duckdns` plugin).
- Caddy handles HTTPS for all services — no manual cert management.

### 4.2 DuckDNS Setup
- Register subdomain at duckdns.org (free).
- Set `DUCKDNS_TOKEN` environment variable for Caddy DNS challenge.
- Add a cron job (or Caddy plugin) to update DuckDNS IP when home IP changes.

### 4.3 Production Environment File
- Create `backend/.env.production` (gitignored):
  - `DATABASE_URL` → PostgreSQL (not SQLite)
  - `REDIS_URL` → Redis with password
  - `JWT_PRIVATE_KEY_PATH` → freshly generated keys
  - `ALLOWED_ORIGINS` → exact DuckDNS URLs
  - `GOOGLE_API_KEY` → real key
- Document all required vars in `.env.production.example`.

### 4.4 Auto-Start on Reboot
- All Docker services already have `restart: unless-stopped`.
- Add a systemd unit file `creatorzone.service` that runs `docker compose up -d` on boot.
- Document setup in `docs/deployment/home-server.md`.

### 4.5 Migration on Deploy
- Add a one-shot `migrate` service to Docker Compose that runs `alembic upgrade head` and exits before the `api` service starts (using `depends_on` with `service_completed_successfully`).

---

## Section 5 — Observability ($0)

### 5.1 Structured Logging
- Configure Python `logging` with JSON formatter in `backend/main.py` startup.
- Log to stdout (Docker captures it). No file I/O needed.

### 5.2 Log Rotation
- Add Docker logging config to all services in compose:
  ```yaml
  logging:
    driver: json-file
    options:
      max-size: "50m"
      max-file: "5"
  ```

### 5.3 Health Check Improvements
- Extend `GET /health` to check: DB connectivity (simple SELECT 1) + Redis ping.
- Return `{"status": "ok", "db": "ok", "redis": "ok"}` or 503 if either fails.
- Use this endpoint for Docker healthchecks on the `api` service.

---

## Section 6 — Frontend Fixes

### 6.1 API Base URL from Env
- **File:** `frontend/services/apiClient.ts`
- Read API base from `EXPO_PUBLIC_API_URL` environment variable instead of hardcoded `127.0.0.1:8000`.
- Add `EXPO_PUBLIC_API_URL=https://api.creatorzone.duckdns.org` to `frontend/.env.production`.

### 6.2 Jobs Backend Sync (optional for beta)
- `frontend/hooks/useJobs.ts` — optionally sync job history to `/jobs` API for cross-device persistence. Low priority for beta.

---

## Implementation Sessions (Ordered)

| Session | Scope | Agent(s) |
|---|---|---|
| **S1** | Migration fix + bug fixes (1.1–1.4) | backend-architect |
| **S2** | Security fixes — SSRF + IDOR (2.1–2.5) | security-auditor + backend-architect |
| **S3** | Security hardening — headers, rate limits, CORS, keys (3.1–3.6) | backend-architect |
| **S4** | Home server setup — Caddy, DuckDNS, compose, systemd (4.1–4.5) | backend-architect |
| **S5** | Observability — logging, health (5.1–5.3) | backend-architect |
| **S6** | Frontend env + API URL fix (6.1) | frontend-developer |
| **S7** | Integration test — full stack smoke test, migration run, health check | code-reviewer + security-auditor |

---

## Out of Scope (Post-Revenue)

- Webhook system for job completion push notifications
- Admin endpoints for user/content moderation
- Automated CI/CD pipeline (GitHub Actions → VPS deploy)
- Full backend test suite (80% coverage target)
- Cloudflare domain + IP masking (when budget allows ~$10/year domain)
- Kubernetes migration (when load demands it)
