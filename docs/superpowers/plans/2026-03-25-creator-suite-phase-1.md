# Creator Suite Phase 1 — Minimum Usable Product

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four core feature subsystems so a real YouTuber can import media, edit on a timeline, run AI processing, and export a finished video. The Flutter app and backend routes work end-to-end.

**Prerequisites:** Phase 0 complete (auth, DB, job queue, storage, CI/CD all working — 43 tests passing).

**Architecture:** Flutter app (Riverpod state management) ↔ FastAPI backend ↔ Celery workers. Media stored in Cloudflare R2 via presigned URLs.

**Tech Stack additions:** Flutter 3.x, Riverpod, Drift (SQLite), ffmpeg_kit_flutter, video_player, Whisper large-v3 (server), Demucs (server)

---

## Task 1: Media Import & Organization — Backend

**Files:**
- Create: `backend/routes/media.py`
- Create: `backend/schemas/media.py`
- Create: `backend/services/media_manager.py`
- Create: `backend/tests/test_media_routes.py`

- [ ] **Step 1: Create media schemas**

```python
# backend/schemas/media.py
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field

class UploadURLRequest(BaseModel):
    project_id: str
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(gt=0, le=2_147_483_648)  # 2GB max

class UploadURLResponse(BaseModel):
    upload_url: str
    storage_key: str

class MediaAssetResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    storage_key: str
    mime_type: str
    size_bytes: int
    duration_seconds: float | None
    download_url: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}

class RegisterAssetRequest(BaseModel):
    project_id: str
    filename: str
    storage_key: str
    mime_type: str
    size_bytes: int
    duration_seconds: float | None = None
```

- [ ] **Step 2: Create media routes**

Endpoints:
- `POST /media/upload-url` — generate presigned upload URL
- `POST /media/register` — register asset after upload completes
- `GET /media?project_id=X` — list assets for a project
- `GET /media/{id}` — get single asset with download URL
- `DELETE /media/{id}` — soft delete asset

- [ ] **Step 3: Create media manager service**

Business logic for:
- Validating file types against allowlist
- Generating storage keys: `media/{user_id}/{project_id}/{uuid}_{filename}`
- Coordinating with R2Client for presigned URLs
- Probing duration via FFmpeg for audio/video files

- [ ] **Step 4: Write tests and verify**

Run: `python -m pytest backend/tests/test_media_routes.py -v`

- [ ] **Step 5: Commit**

---

## Task 2: Media Import — URL Downloads (Backend)

**Files:**
- Create: `backend/services/downloader_service.py`
- Modify: `backend/workers/tasks.py` (add download task)
- Create: `backend/tests/test_download_service.py`

- [ ] **Step 1: Refactor existing downloader.py into a service**

Migrate the existing `downloader.py` (yt-dlp based) into `backend/services/downloader_service.py`:
- Accept URL + target project/user
- Download to temp dir
- Upload to R2
- Register as MediaAsset
- Return asset metadata

- [ ] **Step 2: Add Celery task for async downloads**

```python
# In backend/workers/tasks.py
@celery.task(name="download_media", bind=True)
def download_media(self, job_id: str, url: str, project_id: str, user_id: str) -> dict:
    ...
```

- [ ] **Step 3: Add POST /media/import-url endpoint**

Accepts `{project_id, url}`, creates a Job, dispatches to Celery, returns job_id.

- [ ] **Step 4: Write tests and verify**

- [ ] **Step 5: Commit**

---

## Task 3: AI Processing Engine — Transcription Service

**Files:**
- Create: `backend/services/transcriber_service.py`
- Modify: `backend/workers/tasks.py` (add transcribe dispatcher)
- Create: `backend/tests/test_transcriber_service.py`

- [ ] **Step 1: Refactor existing transcriber.py into service**

Migrate `transcriber.py` into `backend/services/transcriber_service.py`:
- Accept media file path or R2 storage key
- Download from R2 if needed
- Run Whisper large-v3 (word-level timestamps)
- Return structured transcription: `{segments: [{start, end, text, words: [{word, start, end}]}]}`
- Upload result JSON to R2

- [ ] **Step 2: Wire into Celery task dispatcher**

Update `process_job` to dispatch `job_type == "transcribe"` to `transcriber_service`.

- [ ] **Step 3: Update Job model to store progress callbacks**

Workers update `Job.progress` and `Job.status` in DB via direct SQLAlchemy (sync session for Celery workers).

- [ ] **Step 4: Write tests (mock Whisper for unit tests)**

- [ ] **Step 5: Commit**

---

## Task 4: AI Processing Engine — Jump Cut Service

**Files:**
- Create: `backend/services/jumpcut_service.py`
- Create: `backend/tests/test_jumpcut_service.py`

- [ ] **Step 1: Refactor existing jumpcut.py into service**

Migrate `jumpcut.py` into `backend/services/jumpcut_service.py`:
- Accept video storage key + silence threshold + min silence duration
- Download from R2
- Detect silence segments via FFmpeg
- Generate cut list (keep segments)
- Optionally render trimmed video
- Upload result to R2

- [ ] **Step 2: Wire into Celery dispatcher**

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

## Task 5: AI Processing Engine — Audio Cleanup Service

**Files:**
- Create: `backend/services/audio_cleanup_service.py`
- Create: `backend/tests/test_audio_cleanup_service.py`

- [ ] **Step 1: Implement audio cleanup service**

- Accept audio/video storage key
- Download from R2
- Extract audio if video
- Run Demucs for voice isolation / noise removal
- Normalize volume via FFmpeg
- Upload cleaned audio to R2

- [ ] **Step 2: Wire into Celery dispatcher**

- [ ] **Step 3: Write tests (mock Demucs)**

- [ ] **Step 4: Commit**

---

## Task 6: AI Processing Engine — Smart Search Service

**Files:**
- Create: `backend/services/smart_search_service.py`
- Create: `backend/tests/test_smart_search_service.py`

- [ ] **Step 1: Implement smart search service**

- Accept project_id + query text
- Gather all transcriptions for project's media assets
- Extract key frames from video assets (1 per 10 seconds)
- Send frames + transcription to Gemini multimodal API
- Match query against content using Gemini's understanding
- Return ranked list of `{asset_id, start_time, end_time, relevance_score, snippet}`

- [ ] **Step 2: Wire into Celery dispatcher**

- [ ] **Step 3: Write tests (mock Gemini)**

- [ ] **Step 4: Commit**

---

## Task 7: Multi-Format Export — Backend Service

**Files:**
- Create: `backend/services/exporter_service.py`
- Create: `backend/models/export.py`
- Create: `backend/schemas/export.py`
- Create: `backend/routes/exports.py`
- Create: `backend/tests/test_export_service.py`

- [ ] **Step 1: Create Export model**

```python
class Export(Base):
    __tablename__ = "exports"
    id, project_id, user_id, format_preset, aspect_ratio, resolution,
    codec, status, output_storage_key, file_size_bytes, created_at, completed_at
```

Format presets: `youtube_1080p`, `youtube_shorts`, `tiktok`, `instagram_reel`, `custom`

- [ ] **Step 2: Create export service**

- Accept timeline data (JSON) + format preset
- Build FFmpeg filter complex from timeline instructions
- Render to target format/resolution/aspect ratio
- Upload to R2
- Return presigned download URL

- [ ] **Step 3: Create export routes**

- `POST /exports` — start export job
- `GET /exports/{id}` — get export status + download URL
- `GET /exports?project_id=X` — list exports

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 8: Flutter App — Project Scaffolding

**Files:**
- Create: `flutter_app/` directory with Flutter project
- Create: core architecture folders

- [ ] **Step 1: Create Flutter project**

```bash
flutter create --org com.creatorsuite --project-name creator_suite flutter_app
```

- [ ] **Step 2: Add dependencies to pubspec.yaml**

```yaml
dependencies:
  flutter_riverpod: ^2.5
  riverpod_annotation: ^2.3
  go_router: ^14.0
  dio: ^5.4
  flutter_secure_storage: ^9.0
  drift: ^2.16
  sqlite3_flutter_libs: ^0.5
  video_player: ^2.8
  ffmpeg_kit_flutter: ^6.0
  image_picker: ^1.0
  file_picker: ^8.0
  path_provider: ^2.1
  cached_network_image: ^3.3
  shimmer: ^3.0
  lottie: ^3.1

dev_dependencies:
  riverpod_generator: ^2.4
  build_runner: ^2.4
  riverpod_lint: ^2.3
  flutter_test:
    sdk: flutter
  mocktail: ^1.0
```

- [ ] **Step 3: Create core folder structure**

```
lib/
├── main.dart
├── core/
│   ├── theme/app_theme.dart
│   ├── theme/spacing.dart
│   ├── theme/animations.dart
│   ├── network/api_client.dart
│   ├── network/api_exceptions.dart
│   ├── storage/secure_storage.dart
│   ├── storage/local_db.dart
│   └── utils/
├── features/
│   ├── auth/
│   ├── projects/
│   ├── media_bin/
│   ├── timeline/
│   ├── captions/
│   ├── audio/
│   ├── graphics/
│   ├── export/
│   └── jobs/
└── widgets/
```

- [ ] **Step 4: Implement core theme (dark/light, spacing, colors)**

- [ ] **Step 5: Implement API client with JWT interceptor**

Dio-based client with:
- Base URL configuration
- Token injection interceptor
- Auto-refresh on 401
- Error mapping to typed exceptions

- [ ] **Step 6: Commit**

---

## Task 9: Flutter App — Auth Feature

**Files:**
- Create: `flutter_app/lib/features/auth/` (data, domain, ui layers)

- [ ] **Step 1: Implement auth data layer**

- `AuthRepository` — register, login, refresh, getMe via API client
- `TokenStorage` — secure storage for access/refresh tokens

- [ ] **Step 2: Implement auth domain layer**

- `AuthState` — unauthenticated, loading, authenticated(user), error
- `authProvider` — manages auth lifecycle

- [ ] **Step 3: Implement auth UI**

- `LoginScreen` — email/password, animated transitions
- `RegisterScreen` — email/password/display name
- Auth guard router — redirects unauthenticated users

- [ ] **Step 4: Widget tests**

- [ ] **Step 5: Commit**

---

## Task 10: Flutter App — Projects Feature

**Files:**
- Create: `flutter_app/lib/features/projects/` (data, domain, ui layers)

- [ ] **Step 1: Implement projects data/domain**

- `ProjectRepository` — CRUD via API
- `projectsProvider` — list, create, select current project

- [ ] **Step 2: Implement projects UI**

- `ProjectListScreen` — grid/list of projects with thumbnails
- `NewProjectDialog` — title, import sources
- Pull-to-refresh, skeleton loading

- [ ] **Step 3: Widget tests**

- [ ] **Step 4: Commit**

---

## Task 11: Flutter App — Media Bin Feature

**Files:**
- Create: `flutter_app/lib/features/media_bin/` (data, domain, ui layers)

- [ ] **Step 1: Implement media data/domain**

- `MediaRepository` — upload, list, delete, import from URL
- `mediaAssetsProvider` — per-project asset management

- [ ] **Step 2: Implement import flows**

- Camera roll picker (image_picker + file_picker)
- URL import dialog (paste YouTube/social URL)
- Upload progress tracking

- [ ] **Step 3: Implement media bin UI**

- Grid view with thumbnails
- Video preview on tap
- Drag to timeline (prepared for Task 12)
- Search/filter/tag

- [ ] **Step 4: Widget tests**

- [ ] **Step 5: Commit**

---

## Task 12: Flutter App — Timeline Editor (Core)

**Files:**
- Create: `flutter_app/lib/features/timeline/` (data, domain, ui layers)

- [ ] **Step 1: Implement timeline domain model**

```dart
// timeline_model.dart
class Timeline { List<Track> tracks; Duration totalDuration; }
class Track { String id; TrackType type; List<Clip> clips; }
class Clip { String id; String assetId; Duration inPoint; Duration outPoint;
             Duration position; double volume; List<Effect> effects; }
```

- [ ] **Step 2: Implement undo/redo history**

Immutable state stack. Every mutation creates a new state entry.
`Ctrl+Z` pops, `Ctrl+Shift+Z` re-pushes.

- [ ] **Step 3: Implement timeline widget (CustomPainter)**

- Multi-track horizontal scrollable canvas
- Pinch-to-zoom (time scale)
- Clip rendering with thumbnails + waveforms
- Playhead with scrubbing
- Snap-to-edge with haptic feedback

- [ ] **Step 4: Implement toolbar**

- Cut/split at playhead
- Trim handles on clips
- Delete clip
- AI actions menu (transcribe, jump-cut, audio cleanup)

- [ ] **Step 5: Implement video preview player**

- Platform channel to native video player
- Synced with timeline playhead
- Collapsible to maximize timeline space

- [ ] **Step 6: Widget tests + integration tests**

- [ ] **Step 7: Commit**

---

## Task 13: Flutter App — Jobs Feature (AI Processing UI)

**Files:**
- Create: `flutter_app/lib/features/jobs/` (data, domain, ui layers)

- [ ] **Step 1: Implement jobs data/domain**

- `JobRepository` — submit, poll status, list for project
- `jobsProvider` — active jobs with progress polling (5s interval)

- [ ] **Step 2: Implement jobs UI**

- Bottom sheet "AI Processing" drawer
- Job cards: type icon, progress ring, status text
- Tap completed job → navigate to result
- Cancel running job

- [ ] **Step 3: Integrate with timeline AI actions**

- Select clip → "Transcribe" → submit job → show progress → apply result
- Select clip → "Remove silence" → submit jump-cut job
- Select clip → "Clean audio" → submit audio cleanup job

- [ ] **Step 4: Widget tests**

- [ ] **Step 5: Commit**

---

## Task 14: Flutter App — Export Feature

**Files:**
- Create: `flutter_app/lib/features/export/` (data, domain, ui layers)

- [ ] **Step 1: Implement export data/domain**

- `ExportRepository` — start export, poll status, download
- `exportProvider` — format selection, render state

- [ ] **Step 2: Implement export UI**

- Format picker: YouTube 1080p, YouTube Shorts, TikTok, Instagram Reel, Custom
- Quality slider (bitrate)
- Preview of aspect ratio change
- Render progress (full-screen with Lottie animation)
- Download / share when complete

- [ ] **Step 3: Widget tests**

- [ ] **Step 4: Commit**

---

## Task 15: Telegram Bot Migration to API Client

**Files:**
- Modify: `bot.py` (at project root)

- [ ] **Step 1: Refactor bot.py to use CreatorSuiteClient**

Replace direct service calls with API calls:
- `/scarica` (download) → `api.submit_job(project_id, "download", {url})`
- `/trascrivi` (transcribe) → `api.submit_job(project_id, "transcribe", {})`
- `/jumpcut` → `api.submit_job(project_id, "jumpcut", {threshold})`
- Poll for job completion, send result to user

- [ ] **Step 2: Auto-register Telegram users as API users**

Map Telegram user ID to email `telegram_{user_id}@bot.creatorsuite.com`.
Auto-register on first interaction, store tokens.

- [ ] **Step 3: Test via Telegram**

- [ ] **Step 4: Commit**

---

## Task 16: End-to-End Integration Test

- [ ] **Step 1: Run full backend test suite**

```bash
python -m pytest backend/tests/ -v --tb=short
```

- [ ] **Step 2: Run Flutter tests**

```bash
cd flutter_app && flutter test
```

- [ ] **Step 3: Manual E2E test**

1. Register user via Flutter app
2. Create project
3. Import media from camera roll
4. Import media from YouTube URL
5. Arrange clips on timeline
6. Run transcription
7. Run jump-cut
8. Export to YouTube 1080p
9. Download result

- [ ] **Step 4: Commit and tag release**

```bash
git tag v0.1.0-alpha
```

---

## Summary

| Task | What it delivers | Type |
|------|-----------------|------|
| 1 | Media upload/download via presigned URLs | Backend |
| 2 | URL-based media import (yt-dlp) | Backend |
| 3 | Transcription service (Whisper) | Backend |
| 4 | Jump-cut service (FFmpeg) | Backend |
| 5 | Audio cleanup service (Demucs) | Backend |
| 6 | Smart search service (Gemini) | Backend |
| 7 | Multi-format export service | Backend |
| 8 | Flutter app scaffolding + core | Flutter |
| 9 | Auth screens + JWT flow | Flutter |
| 10 | Projects list + creation | Flutter |
| 11 | Media bin + import flows | Flutter |
| 12 | Timeline editor (THE core feature) | Flutter |
| 13 | AI processing UI + job tracking | Flutter |
| 14 | Export format picker + render | Flutter |
| 15 | Telegram bot → API client migration | Bot |
| 16 | E2E integration test | Verification |
