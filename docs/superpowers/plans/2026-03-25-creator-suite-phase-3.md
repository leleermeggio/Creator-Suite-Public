# Creator Suite Phase 3 — Scale Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collaboration, analytics, and a plugin system so the app can serve teams and scale to a public launch with subscriptions.

**Prerequisites:** Phase 2 complete (captions, audio mixer, graphics all working).

---

## Task 1: Collaboration — Data Model & Backend

**Files:**
- Create: `backend/models/team.py`
- Create: `backend/models/project_member.py`
- Create: `backend/models/comment.py`
- Create: `backend/schemas/collaboration.py`
- Create: `backend/routes/teams.py`
- Create: `backend/routes/comments.py`
- Create: `backend/tests/test_collaboration.py`

- [ ] **Step 1: Design collaboration models**

```python
class Team(Base):
    __tablename__ = "teams"
    id, name, owner_id, created_at

class TeamMember(Base):
    __tablename__ = "team_members"
    id, team_id, user_id, role (owner|editor|viewer), invited_at, accepted_at

class ProjectMember(Base):
    __tablename__ = "project_members"
    id, project_id, user_id, role (owner|editor|commenter|viewer), granted_at

class Comment(Base):
    __tablename__ = "comments"
    id, project_id, user_id, timeline_timestamp (nullable),
    asset_id (nullable), text, resolved, created_at, updated_at
```

- [ ] **Step 2: Implement team routes**

- `POST /teams` — create team
- `POST /teams/{id}/members` — invite member
- `DELETE /teams/{id}/members/{user_id}` — remove member
- `PUT /teams/{id}/members/{user_id}` — change role
- `GET /teams` — list user's teams

- [ ] **Step 3: Implement project sharing**

- `POST /projects/{id}/share` — share with user/team
- `GET /projects/{id}/members` — list project members
- Update all existing routes to check project membership (not just ownership)

- [ ] **Step 4: Implement comments**

- `POST /projects/{id}/comments` — add comment (optionally at timeline position)
- `GET /projects/{id}/comments` — list comments
- `PUT /comments/{id}` — edit comment
- `PUT /comments/{id}/resolve` — mark resolved

- [ ] **Step 5: Write tests**

- [ ] **Step 6: Commit**

---

## Task 2: Real-Time Collaboration — WebSocket

**Files:**
- Create: `backend/routes/ws.py`
- Create: `backend/services/realtime_service.py`
- Create: `backend/tests/test_websocket.py`

- [ ] **Step 1: Implement WebSocket endpoint**

```python
@router.websocket("/ws/{project_id}")
async def project_ws(websocket: WebSocket, project_id: str):
    # Authenticate via token query param
    # Join project room
    # Broadcast: cursor position, comment added, job status, timeline changes
```

- [ ] **Step 2: Event types**

- `cursor_move` — show collaborator's playhead position
- `comment_added` — real-time comment notifications
- `job_progress` — push job status updates (replace polling)
- `timeline_changed` — optimistic sync of timeline edits

- [ ] **Step 3: Flutter WebSocket client**

Update `api_client.dart` to maintain WebSocket connection per project.
Feed events into Riverpod providers.

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 3: Review & Approval Workflow

**Files:**
- Create: `backend/models/review.py`
- Create: `backend/routes/reviews.py`
- Create: `backend/tests/test_reviews.py`

- [ ] **Step 1: Create Review model**

```python
class Review(Base):
    __tablename__ = "reviews"
    id, project_id, export_id, reviewer_id, status (pending|approved|changes_requested),
    notes, created_at, responded_at
```

- [ ] **Step 2: Implement review routes**

- `POST /reviews` — request review from team member
- `PUT /reviews/{id}` — approve or request changes
- `GET /reviews?project_id=X` — list reviews

- [ ] **Step 3: Push notifications for review requests**

- [ ] **Step 4: Flutter UI — review screen**

- [ ] **Step 5: Commit**

---

## Task 4: Analytics & Telemetry — Backend

**Files:**
- Create: `backend/models/analytics_event.py`
- Create: `backend/routes/analytics.py`
- Create: `backend/services/analytics_service.py`
- Create: `backend/tests/test_analytics.py`

- [ ] **Step 1: Create analytics event model**

```python
class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id, user_id, event_type, event_data (JSON), device_info (JSON),
    app_version, created_at
```

Event types:
- `feature_used` — which AI tool, how often
- `export_completed` — format, duration, processing time
- `session_duration` — app usage patterns
- `error_occurred` — client-side errors

- [ ] **Step 2: Implement batch event ingestion**

- `POST /analytics/events` — accept batch of events (up to 100)
- Fire-and-forget from client, don't block UX
- Rate limit: 1000 events/day per user

- [ ] **Step 3: Implement dashboard queries**

- `GET /analytics/dashboard` — admin-only aggregate stats
- Active users (DAU/WAU/MAU)
- Feature usage breakdown
- Job queue health
- Storage usage per user

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 5: Analytics — Flutter Integration

**Files:**
- Modify: `flutter_app/lib/core/network/` (add analytics client)
- Create: `flutter_app/lib/core/analytics/` (event tracking)

- [ ] **Step 1: Implement event tracker**

- Singleton `AnalyticsTracker`
- Buffer events locally, flush in batches every 30s or on app background
- Track: screen views, feature taps, export starts/completions, errors

- [ ] **Step 2: Integrate into existing features**

Add tracking calls to:
- Timeline: clip added/removed, AI tool used, export started
- Media: import source type, file sizes
- Captions: generated, edited, translated
- Sessions: app open/close, screen time

- [ ] **Step 3: Commit**

---

## Task 6: Subscription & Quota System — Backend

**Files:**
- Create: `backend/models/subscription.py`
- Create: `backend/services/quota_service.py`
- Create: `backend/routes/subscriptions.py`
- Create: `backend/middleware/quota.py`
- Create: `backend/tests/test_quotas.py`

- [ ] **Step 1: Create subscription models**

```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    id, user_id, plan (free|pro|team), status (active|cancelled|expired),
    started_at, expires_at, payment_provider, payment_id

class UsageCounter(Base):
    __tablename__ = "usage_counters"
    id, user_id, counter_type (ai_jobs|exports|storage_bytes),
    current_value, period_start, period_end
```

- [ ] **Step 2: Implement quota service**

```python
PLAN_LIMITS = {
    "free":  {"ai_jobs_day": 100, "exports_day": 10, "storage_gb": 50, "concurrent_jobs": 3, "projects": 5},
    "pro":   {"ai_jobs_day": 1000, "exports_day": -1, "storage_gb": 500, "concurrent_jobs": 10, "projects": -1},
    "team":  {"ai_jobs_day": 5000, "exports_day": -1, "storage_gb": 2000, "concurrent_jobs": 20, "projects": -1},
}
```

- Check quota before job submission, export, upload
- Increment counters on use
- Reset daily counters via Celery Beat scheduled task

- [ ] **Step 3: Quota middleware**

FastAPI dependency that checks quotas before processing.
Returns `429 Too Many Requests` with retry-after when exceeded.

- [ ] **Step 4: Subscription routes**

- `GET /subscriptions/me` — current plan + usage
- `POST /subscriptions/upgrade` — upgrade plan (integrate with payment provider later)

- [ ] **Step 5: Write tests**

- [ ] **Step 6: Commit**

---

## Task 7: Plugin / Extension System — Architecture

**Files:**
- Create: `backend/plugins/__init__.py`
- Create: `backend/plugins/registry.py`
- Create: `backend/plugins/base.py`
- Create: `backend/tests/test_plugins.py`

- [ ] **Step 1: Define plugin interface**

```python
class BasePlugin(ABC):
    name: str
    version: str
    description: str
    job_types: list[str]  # new job types this plugin handles

    @abstractmethod
    async def process(self, job: Job, input_data: dict) -> dict:
        """Execute the plugin's processing logic."""

    @abstractmethod
    def get_schema(self) -> dict:
        """Return JSON schema for input_params validation."""
```

- [ ] **Step 2: Implement plugin registry**

- Discover plugins from `backend/plugins/` directory
- Register custom job types
- Route jobs to correct plugin handler
- Plugins can define their own Celery tasks

- [ ] **Step 3: Create example plugin**

`backend/plugins/watermark.py` — adds watermark to exported videos.
Demonstrates the plugin interface.

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 8: Flutter — Collaboration UI

**Files:**
- Modify: `flutter_app/lib/features/projects/` (add sharing)
- Create: `flutter_app/lib/features/collaboration/` (teams, comments, reviews)

- [ ] **Step 1: Team management UI**

- Create/manage teams
- Invite members (email or link)
- Role management

- [ ] **Step 2: Project sharing UI**

- Share button on project → select team/user → set role
- Shared project indicators in project list

- [ ] **Step 3: Comments UI**

- Comment sidebar in timeline editor
- Tap timeline to pin comment at timestamp
- Thread-style replies
- Resolve/unresolve

- [ ] **Step 4: Review UI**

- Request review button on export
- Review status badge
- Approve/request changes flow

- [ ] **Step 5: Widget tests**

- [ ] **Step 6: Commit**

---

## Task 9: Flutter — Subscription & Settings

**Files:**
- Create: `flutter_app/lib/features/settings/` (profile, subscription, preferences)

- [ ] **Step 1: Settings screen**

- Profile editing (display name, avatar)
- Subscription status + upgrade prompt
- Usage dashboard (storage used, jobs today, exports today)
- Theme preference (dark/light/system)
- Notification preferences

- [ ] **Step 2: Paywall / upgrade flow**

- Show limits when quota exceeded
- Plan comparison screen
- Upgrade button (links to payment provider)

- [ ] **Step 3: Commit**

---

## Task 10: Production Readiness

- [ ] **Step 1: Security audit**

- Review all routes for auth checks
- Verify resource-level authorization (user can't access others' data)
- Check rate limits on all endpoints
- Validate input sanitization

- [ ] **Step 2: Performance optimization**

- Add database indexes for common queries
- Implement response caching (Redis) for read-heavy endpoints
- Optimize media thumbnail generation (lazy, cached)
- Profile and optimize Celery task memory usage

- [ ] **Step 3: Error handling & monitoring**

- Global error handler with structured logging
- Sentry integration for error tracking
- Health check endpoint with dependency checks (DB, Redis, R2)
- Uptime monitoring

- [ ] **Step 4: Documentation**

- API documentation (FastAPI auto-generates OpenAPI)
- Developer setup guide
- Deployment runbook

- [ ] **Step 5: Final test suite**

```bash
python -m pytest backend/tests/ -v --cov=backend --cov-report=html
cd flutter_app && flutter test --coverage
```

- [ ] **Step 6: Tag release**

```bash
git tag v1.0.0
```

---

## Summary

| Task | What it delivers | Type |
|------|-----------------|------|
| 1 | Collaboration data model + sharing | Backend |
| 2 | Real-time WebSocket sync | Backend + Flutter |
| 3 | Review & approval workflow | Backend |
| 4 | Analytics event tracking | Backend |
| 5 | Analytics Flutter integration | Flutter |
| 6 | Subscription & quota system | Backend |
| 7 | Plugin / extension architecture | Backend |
| 8 | Collaboration UI (teams, comments, reviews) | Flutter |
| 9 | Settings & subscription UI | Flutter |
| 10 | Production readiness (security, perf, monitoring) | Infrastructure |
