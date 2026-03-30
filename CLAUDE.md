# CLAUDE.md — CazZone Creator Suite

Team instructions for Claude Code. Covers the full monorepo:
- `backend/` — FastAPI REST API (Python 3.11, async, SQLAlchemy, Celery)
- `frontend/` — React Native / Expo app (TypeScript, expo-router)
- `bot.py` — Legacy Telegram bot (python-telegram-bot ≥22, async)

> Personal overrides go in `CLAUDE.local.md` (gitignored).
> Modular rules: @.claude/rules/code-style.md | @.claude/rules/api-conventions.md | @.claude/rules/testing.md

---

## Quick Start

```bash
# Backend (dev, no Docker)
cd backend && python ../run_server.py
# Seeds dev user
python -m backend.seeds.dev_user   # dev@cazzone.local / CazZone2024!

# Backend (Docker — scalable)
cd backend && docker compose up -d

# Frontend
cd frontend && npx expo start --web

# Telegram bot (legacy)
python -m venv .venv && source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
python bot.py
```

## Prerequisites
- Python 3.10+, Node 20+, Docker
- ffmpeg (for bot audio/video processing)
- JWT keys at `backend/keys/private.pem` + `public.pem` (already committed for dev)

---

## Architecture

### Backend (`backend/`)
FastAPI app with factory pattern (`create_app()`), runs on port **8000**.

| Module | Role |
|--------|------|
| `main.py` | App factory, CORS, middleware, router registration |
| `auth/` | JWT RS256 auth — register, login, refresh, `/auth/me` |
| `routes/` | REST endpoints: projects, jobs, media, captions, audio, thumbnails, graphics, tools, exports, search, watermark, teams, subscriptions, analytics |
| `models/` | SQLAlchemy ORM models |
| `schemas/` | Pydantic request/response schemas |
| `services/` | Business logic (Gemini AI, Whisper, FFmpeg, Celery tasks) |
| `workers/` | Celery async job workers |
| `migrations/` | Alembic DB migrations |

**Key patterns:**
- All endpoints require JWT auth via `get_current_user` dependency
- Async job endpoints return `{"job_id": "...", "status": "queued"}` (202)
- Rate limiting via slowapi (5 req/min on auth endpoints)
- R2 storage for media assets (local dev uses SQLite + local paths)

**Tools router** (`/tools`):
- `POST /tools/translate` — text + target_language → translated text (Gemini → MyMemory fallback)
- `POST /tools/summarize` — text → bullet-point summary (Gemini, requires GOOGLE_API_KEY)
- `POST /tools/ocr` — image_base64 → extracted text (Gemini Vision)

### Frontend (`frontend/`)
Expo Router tab-based app. Local-first (AsyncStorage) + BE sync.

| Module | Role |
|--------|------|
| `app/(tabs)/` | Tab navigator: Projects, Quick Tools, Activity, Settings |
| `app/project/[id].tsx` | Project workspace (phases, files, tools) |
| `app/new-project/` | Project creation flow (template → customize → create) |
| `app/tool/[id].tsx` | Tool execution screen (all 9 tools) |
| `app/login.tsx` | Auth screen |
| `services/apiClient.ts` | Centralized API client (JWT, auto-refresh, error handling) |
| `services/authApi.ts` | Auth endpoints wrapper |
| `services/projectsApi.ts` | Projects BE sync |
| `hooks/useAuth.ts` | Auth state + login/logout |
| `hooks/useProjects.ts` | Project list (hybrid: BE id + local phases) |
| `hooks/useProject.ts` | Single project (phases, files, advance) |
| `context/AuthContext.tsx` | Auth React context |

**Key patterns:**
- Projects: BE owns `{id, title}`, AsyncStorage owns `phases[]` keyed by BE project id
- Tools route through BE (`/tools/*`, `/thumbnails/generate`) — no API keys in FE
- JWT stored in AsyncStorage (`auth_access_token`, `auth_refresh_token`)
- 401 auto-triggers token refresh then retry

### Telegram Bot (`bot.py`)
Single-process async bot, `ConversationHandler` with 14 states.
All user-facing strings in Italian. Auth via `ALLOWED_USERS` env var.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | sqlite+aiosqlite:///./creator_suite_dev.db | Switch to postgres for prod |
| `REDIS_URL` | redis://localhost:6379/0 | Required for Celery workers |
| `JWT_PRIVATE_KEY_PATH` | keys/private.pem | RS256 |
| `GOOGLE_API_KEY` | — | Gemini AI + Vision |
| `ALLOWED_ORIGINS` | http://localhost:3000,... | Comma-separated CORS origins |

### Bot (`.env`)
| Variable | Notes |
|----------|-------|
| `TELEGRAM_TOKEN` | Required |
| `ALLOWED_USERS` | Comma-separated Telegram user IDs (empty = allow all) |
| `WHISPER_MODEL` | tiny/base/small/medium (default: small) |

---

## Conventions

### All code
- No TODOs in committed code — open a GitHub issue instead
- Descriptive variable names over comments
- No unused imports

### Python (backend + bot)
- `async def` throughout — never blocking calls in async context
- Pydantic schemas for all inputs/outputs
- Logging with emoji prefixes for visual scanning
- Type hints on all function signatures

### TypeScript (frontend)
- Named exports only (no default exports in services/hooks)
- `async/await` — no raw `.then()` chains
- All user-facing strings in Italian
- Cosmic neon theme via `constants/theme.ts` (COLORS, TYPO, FONTS, RADIUS, SPACING)

---

## Agentic Operation Rules (R.D.P.A.S)

- **R**educe context — use `/clear` between unrelated tasks; load only relevant files
- **D**elegate to agents — use `Task` tool to spawn subagents for independent work
- **P**arallel dispatch — launch multiple agents in a single message when tasks are independent
- **A**utomate via hooks — hooks handle formatting, safety checks, and snapshots automatically
- **S**elf-improve — update this CLAUDE.md when you discover better patterns

### Agent Dispatch Patterns

| Intent | Agents to dispatch in parallel |
|--------|-------------------------------|
| build/feature | frontend-developer + backend-architect + code-reviewer |
| fix/debug | systematic-debugger + code-reviewer |
| security | security-auditor + code-reviewer |
| research | Explore (codebase) + docs agent |
| test | test-generator + code-reviewer |

### Context Management

- 75%+ context used → run `/clear` and summarize state before continuing
- PreCompact hook auto-snapshots git state to `.claude/shared/snapshots/` before compaction
- Each agent gets a clean, focused context — never pass the full conversation to subagents

### Hooks Active in This Project

| Hook | Trigger | What it does |
|------|---------|--------------|
| `session-init.sh` | Session start | Detects stack, checks backend health |
| `block-destructive-commands.sh` | Before any Bash | Blocks `rm -rf /`, `dd if=`, `chmod 777`, etc. |
| `auto-format.sh` | After Edit/Write | Runs ruff (Python) or prettier (TS/JS) automatically |
| `quality-gate.sh` | End of each turn | Checks Python syntax + TS compilation errors |
| `knowledge-sync.sh` | Before compaction | Saves git snapshot to `.claude/shared/snapshots/` |
