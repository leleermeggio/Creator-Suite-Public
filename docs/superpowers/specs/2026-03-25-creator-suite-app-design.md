# Creator Suite App — Design Specification

> A content creator suite mobile app for YouTubers that provides AI-powered video editing from A to Z.

## 1. Product Overview

### Vision
Transform the existing Caz_zoneBot Telegram bot into a full-featured mobile app (iOS + Android) that helps YouTubers and content creators build their videos from raw footage to published content. AI handles the tedious work; creators keep creative control.

### Target Users
- **Phase 1:** Solo YouTubers (closed beta with ~10 known creators)
- **Phase 2:** YouTube editors hired by creators
- **Phase 3:** Creator teams (creator + editor collaboration)
- **Phase 4:** Public launch with subscription model

### Content Types Supported
Mixed: talking head, B-roll, screen recordings, cinematic, and any combination.

### Core Pain Points Solved
1. Cutting/trimming — removing bad takes, dead air, silences
2. Captions/subtitles — adding, styling, syncing text
3. Audio cleanup — noise removal, volume normalization
4. Thumbnails/graphics — title cards, lower thirds, overlays
5. Finding the right clip — searching through hours of footage
6. Multi-format export — YouTube, Shorts, TikTok, Instagram Reels

## 2. System Architecture

### Approach: Monolith API + Flutter (Approach A)

One Python backend (FastAPI) serving a REST API. Flutter app and Telegram bot are both clients of the same API. Async job queue handles all heavy processing.

```
Flutter App  ──┐
               ├──▶  FastAPI Backend  ──▶  Worker Queue (Celery/Redis)
Telegram Bot ──┘         │                      │
                     PostgreSQL            FFmpeg/Whisper/Gemini
```

### Why Monolith Over Microservices
- Handles 1000+ users without architectural changes
- Clean internal service boundaries allow surgical extraction later if needed
- One codebase = faster iteration for a small team
- 1-day migration per service if splitting is ever needed

### Hybrid Processing (On-device + Cloud)
- **On-device:** Lightweight edits (trim, reorder, UI interactions), small format conversions, translation
- **Cloud:** Transcription (Whisper), silence detection, audio cleanup, smart search, caption generation, multi-format export

## 3. Data Model

### Core Entities

```
User
 └── Project (one video = one project)
      ├── MediaAsset[]        (imported clips, audio, images)
      ├── Timeline            (the edit)
      │    ├── Track[]        (video, audio, caption, overlay tracks)
      │    │    └── Clip[]    (segment on track with in/out points, position)
      ├── Export[]            (rendered outputs — project-level, references timeline state)
      ├── Caption[]           (generated or manual, linked to timeline)
      ├── Job[]               (async AI/processing tasks)
      └── Thumbnail[]         (generated or uploaded)
```

### Key Design Decisions

**MediaAsset vs Clip separation:** A MediaAsset is the original imported file. A Clip is a reference to a slice of a MediaAsset placed on the timeline. One MediaAsset can produce many Clips. Deleting a Clip does not delete the source file.

**Non-destructive timeline:** The timeline stores instructions (cut, place, effect), never modifies original media. Export renders the final output by executing those instructions. Users can always undo and go back.

**Job model:**
```
Job:
  id, project_id, type (transcribe|jumpcut|export|caption|audio_cleanup|...)
  status (queued|processing|completed|failed)
  progress (0-100)
  input_params (JSON)
  result (JSON — output file paths, transcription text, etc.)
  created_at, started_at, completed_at
```

**Multi-format export:** One timeline, many Export records. Each Export specifies format, aspect ratio, resolution, codec.

## 4. AI Processing Engine

| Service | Input | Output | Engine | On-device? |
|---------|-------|--------|--------|------------|
| Transcribe | audio/video | timestamped text (word-level) | Whisper large-v3 (server-side; existing bot used `small` due to local constraints) | No |
| Jump Cut | video + threshold | trimmed video or cut list | FFmpeg | Detection on-device, processing cloud |
| Auto Captions | transcription | styled SRT/ASS + burn-in | Whisper + FFmpeg | No |
| Audio Cleanup | audio track | denoised audio | Demucs/FFmpeg | No |
| Smart Search | query + project media | ranked clips with timestamps | Gemini multimodal | No |
| Thumbnail Gen | video frame + prompt | styled thumbnail | Gemini image gen | No |
| Multi-Export | timeline + format | rendered video files | FFmpeg | No |
| Translation | caption text + lang | translated captions | deep-translator | Could be on-device |
| TTS | text + voice | audio file | edge-tts | Could be on-device |
| Format Convert | media + target format | converted file | FFmpeg | Small files on-device |

### Job Lifecycle
Client submits job via POST /jobs. API validates, enqueues to Redis. Celery worker picks up, processes, updates progress. Client polls or receives WebSocket push for status updates.

### Smart Search (Differentiating Feature)
Creator imports hours of raw footage. Types "the part where I talk about the new camera." App uses Gemini multimodal to analyze video frames + transcription and match against natural language queries. No other mobile editor does this well.

## 5. Flutter App Architecture

### Technology
- **Framework:** Flutter
- **State management:** Riverpod
- **Local storage:** SQLite via Drift (offline project cache)
- **Secure storage:** flutter_secure_storage (tokens)
- **Animations:** Lottie for micro-animations, custom curves for timeline

### Screen Structure

```
Auth (login/register)
 └── Home (project list)
      ├── + New Project → Import Sources
      └── Open Project → Project Workspace
                          ├── Media Bin
                          ├── Timeline Editor (core screen)
                          │    ├── Video preview player
                          │    ├── Multi-track timeline
                          │    ├── Toolbar (cut, split, trim, undo/redo)
                          │    └── AI quick actions
                          ├── Caption Editor
                          ├── Audio Mixer
                          ├── Graphics
                          └── Export
```

### Navigation
- Timeline Editor is the hub (80% of time spent here)
- Bottom tab bar: Timeline | Media | Captions | Audio | Export
- AI features accessible from context (select clip → long press → AI options)
- Job progress drawer slides up from bottom

### Code Structure

```
lib/
├── core/           # Theme, network, storage, utils
├── features/       # Feature modules (auth, projects, media_bin, timeline,
│                   #   captions, audio, graphics, export, jobs)
│   └── <feature>/
│       ├── data/       # Repository, API calls
│       ├── domain/     # Models, business logic
│       └── ui/         # Screens, widgets
└── widgets/        # Shared UI components
```

### UX Quality Standards
- Undo/redo as first-class citizen (immutable state stack)
- Optimistic UI (clip drag/trim updates instantly, syncs in background)
- Offline-first (project timeline cached locally, syncs when online)
- Micro-animations (Lottie for states, custom curves for clip snapping)
- Haptic feedback (snap points, button presses, gesture confirmations)
- Portrait for quick edits, landscape for precision timeline work

### Provider Hierarchy
```
authProvider        → JWT, refresh, user state
projectsProvider    → CRUD, list, current project
mediaAssetsProvider → per-project asset list, import state
timelineProvider    → tracks, clips, playhead, undo stack
jobsProvider        → active jobs, progress streams via WebSocket
captionsProvider    → caption list, current edit
exportProvider      → format selection, render state
```

## 6. Backend API Structure

```
backend/
├── main.py                  # FastAPI app, startup/shutdown, middleware
├── config.py                # Environment variables, settings
├── models/                  # SQLAlchemy ORM (user, project, media_asset,
│                            #   timeline, clip, caption, job, export)
├── schemas/                 # Pydantic request/response schemas
├── routes/                  # API endpoints (auth, projects, media,
│                            #   timeline, jobs, captions, exports)
├── services/                # Business logic
│   ├── transcriber.py       # ← from existing transcriber.py
│   ├── translator.py        # ← from existing translator.py
│   ├── downloader.py        # ← from existing downloader.py
│   ├── media_processor.py   # ← from existing services.py
│   ├── jumpcut.py           # ← from existing jumpcut.py
│   ├── audio_cleanup.py     # new — Demucs/FFmpeg denoising
│   ├── smart_search.py      # new — Gemini multimodal clip search
│   ├── thumbnail_gen.py     # new — Gemini image generation
│   └── exporter.py          # new — multi-format render pipeline
├── workers/                 # Celery task definitions
│   ├── celery_app.py
│   └── tasks.py
├── storage/                 # S3/MinIO presigned URL helpers
├── middleware/               # Auth, rate limiting, logging
├── migrations/              # Alembic DB migrations
└── tests/
```

### Migration Path from Existing Bot
- `transcriber.py` → `services/transcriber.py` (add async wrapper)
- `translator.py` → `services/translator.py` (as-is)
- `downloader.py` → `services/downloader.py` (refactor into class)
- `services.py` → `services/media_processor.py` (split into focused modules)
- `jumpcut.py` → `services/jumpcut.py` (as-is)
- `bot.py` → thin API client in separate `telegram_bot/` directory

## 7. Security Architecture

### Authentication
- JWT with RS256 (asymmetric signing)
- Short-lived access tokens (15 min TTL)
- Refresh token rotation (each refresh invalidates previous token)
- Device binding (refresh tokens tied to device fingerprint)

### Authorization
- Resource-level: every DB query filters by user_id
- User A can never access User B's projects/media/jobs
- Enforced at ORM level, not just route level

### API Security
- CORS restricted to app origins
- Rate limiting per user per endpoint:
  - Auth: 5/min (brute force prevention)
  - Job submit: 20/min (cost abuse prevention)
  - Upload: 30/min
  - Default: 100/min
- Request validation: max 2GB upload, allowed media types only, path traversal prevention
- Input sanitization via Pydantic schemas (length limits, URL validation)

### Media Storage Security
- Presigned URLs for upload/download (time-limited, single-use)
- Large files never flow through API server
- User-scoped storage prefixes: `media/{user_id}/{project_id}/`

### Data Protection
- Passwords: bcrypt with cost factor 12
- API keys: environment variables only
- Database: encrypted at rest
- Transport: TLS everywhere
- Secrets: Docker secrets or Vault in production

### Abuse Prevention (Per-User Quotas)
- Storage: 50GB free, 500GB pro
- AI jobs: 100/day free, 1000/day pro
- Concurrent jobs: 3 free, 10 pro
- Export: 10/day free, unlimited pro
- Projects: 5 free, unlimited pro
- Job timeout: 30 minutes max
- Output cleanup: auto-delete after 7 days

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
X-Request-ID: <uuid>
Cache-Control: no-store
```

### Security Logging
- Failed login attempts (alert after 5 in 10 min)
- Rate limit hits
- Authorization failures
- Job cost anomalies
- Presigned URL generation audit trail
- Never log tokens or passwords

## 8. Infrastructure & Deployment

### Zero-Cost Start Strategy

**FREE tier (10 users, beta):**

| Service | Provider | Limit |
|---------|----------|-------|
| Backend hosting | Railway/Render free tier | 500 hours/month |
| Database | Neon PostgreSQL free | 512MB, auto-suspend |
| Redis | Upstash free | 10,000 commands/day |
| Object storage | Cloudflare R2 free | 10GB, zero egress |
| AI workers | Local machine | Celery worker on dev PC |
| CI/CD | GitHub Actions free | 2,000 min/month |
| Monitoring | BetterStack free | Basic uptime + alerting |
| TLS/Domain | Cloudflare free | SSL, DNS, CDN |
| **Total** | **$0/month** | |

**Local worker trick:** Cloud hosts the API and data. Your local machine connects to cloud Redis, picks up heavy processing jobs (FFmpeg, Whisper), uploads results to R2. Zero compute cost.

**CHEAP tier ($15-30/mo, 50-100 users):**

| Upgrade | Cost |
|---------|------|
| Railway/Render paid | ~$5-10/mo |
| Hetzner VPS for workers | ~$10-15/mo |
| Neon/Upstash/R2 | still free |

**SCALE tier ($50-150/mo, 500-1000 users):**

| Upgrade | Cost |
|---------|------|
| Hetzner dedicated or multi-node | ~$50-100/mo |
| Managed PostgreSQL | ~$15-25/mo |
| R2 | ~$0-5/mo |

### Migration Path (Zero Code Changes)
- Same Docker containers everywhere (local, Railway, Hetzner)
- Same Redis protocol (Upstash → self-hosted, change URL only)
- Same S3 API (R2 → AWS S3 → MinIO, change endpoint only)
- Same PostgreSQL (Neon → managed → self-hosted, change connection string only)

### Docker Compose (Two Separate Files)

```yaml
# docker-compose.yml (deployed to Railway/Render — cloud API)
services:
  api:
    build: ./backend
    environment:
      DATABASE_URL: ${NEON_DATABASE_URL}
      REDIS_URL: ${UPSTASH_REDIS_URL}
      S3_ENDPOINT: ${R2_ENDPOINT}
```

```yaml
# docker-compose.worker.yml (runs on your local machine)
services:
  worker:
    build: ./backend
    command: celery -A workers.celery_app worker --concurrency=2
    environment:
      REDIS_URL: ${UPSTASH_REDIS_URL}
      S3_ENDPOINT: ${R2_ENDPOINT}
```

### Production Scaling (1000 users)

```yaml
services:
  api:
    deploy:
      replicas: 2
  worker:
    deploy:
      replicas: 3-10  # scale based on queue depth
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
  nginx:
    image: nginx:alpine
    ports: ["443:443"]
  telegram-bot:
    build: ./telegram_bot
    depends_on: [api]
```

## 9. Build Phases

### Phase 0 — Infrastructure Foundation
- Auth (JWT RS256, registration, login, token refresh)
- FastAPI skeleton with middleware (CORS, rate limiting, auth)
- PostgreSQL schema + Alembic migrations
- Celery + Redis job queue
- Cloudflare R2 integration with presigned URLs
- CI/CD pipeline (GitHub Actions)
- Telegram bot refactored as API client

### Phase 1 — Minimum Usable Product
- Media import (camera roll, files, URLs via existing downloader)
- Timeline editor (multi-track, cut/split/trim, undo/redo)
- AI engine: transcription, jump-cut, audio cleanup
- Video preview player (native platform channel)
- Multi-format export (YouTube, Shorts, TikTok, Instagram)
- Job progress tracking (polling + WebSocket)

### Phase 2 — Enhancement Layer
- Auto-captions (generate, edit, style, burn-in, export SRT)
- Audio mixer (volume curves, music tracks, noise removal)
- Graphics (thumbnails via Gemini, title cards, lower thirds)
- Smart search (natural language clip finder)
- Translation (multilingual caption versions)
- TTS (voiceover generation)

### Phase 3 — Scale Features
- Collaboration (project sharing, review/approval, comments)
- Analytics & telemetry (usage patterns, feature adoption)
- Plugin/extension system
- Subscription management & billing
- Public launch

## 10. Design Tools & Assets

- **App branding** (logo, icons, marketing): Nanobanana (AI image editor)
- **In-app AI image generation** (thumbnails, graphics): Google Gemini API (already integrated)

## 11. Technology Summary

| Layer | Technology |
|-------|-----------|
| Mobile app | Flutter + Riverpod |
| Backend API | FastAPI (Python) |
| Job queue | Celery + Redis |
| Database | PostgreSQL + Alembic |
| Object storage | Cloudflare R2 (S3-compatible) |
| AI/ML | Whisper, FFmpeg, Gemini, Demucs, edge-tts, deep-translator |
| Auth | JWT RS256 |
| Hosting | Railway/Render → Hetzner |
| CI/CD | GitHub Actions |
| Monitoring | BetterStack + Grafana |
| Test harness | Existing Telegram bot as API client |
