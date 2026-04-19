---
type: module
path: "backend/"
status: active
language: python
purpose: "FastAPI REST API with JWT auth, SQLAlchemy async ORM, Celery async jobs, Gemini AI integration"
maintainer: "Emanuele"
depends_on: ["[[entities/FastAPI]]", "[[entities/SQLAlchemy]]", "[[entities/Celery]]", "[[entities/Redis]]", "[[entities/Gemini]]"]
used_by: ["[[modules/frontend]]", "[[modules/bot]]"]
tags: [module, backend]
created: 2026-04-18
updated: 2026-04-18
---

# Backend

FastAPI app with factory pattern (`create_app()`), port **8000**.

## Submodules

| Path | Role |
|------|------|
| `main.py` | App factory, CORS, middleware, router registration |
| `auth/` | JWT RS256 auth — register, login, refresh, `/auth/me` |
| `routes/` | REST endpoints: projects, jobs, media, captions, audio, thumbnails, graphics, tools, exports, search, watermark, teams, subscriptions, analytics |
| `models/` | SQLAlchemy ORM models |
| `schemas/` | Pydantic request/response schemas |
| `services/` | Business logic (Gemini AI, Whisper, FFmpeg, Celery tasks) |
| `workers/` | Celery async job workers |
| `migrations/` | Alembic DB migrations |

## Patterns

- All endpoints require JWT auth via `get_current_user` dependency
- Async job endpoints return `{"job_id": "...", "status": "queued"}` (202)
- Rate limiting via slowapi (5 req/min on auth endpoints)
- R2 storage for media assets (local dev uses SQLite + local paths)

## Tools router (`/tools`)

- `POST /tools/translate` — text + target_language → translated text (Gemini → MyMemory fallback)
- `POST /tools/summarize` — text → bullet-point summary (Gemini, requires GOOGLE_API_KEY)
- `POST /tools/ocr` — image_base64 → extracted text (Gemini Vision)

## Related

- [[flows/auth-flow]]
- [[flows/async-job-flow]]
- [[flows/tools-request]]
- [[decisions/api-conventions]]
- [[decisions/code-style]]
- [[decisions/testing]]
