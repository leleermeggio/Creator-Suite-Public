---
title: Architecture overview
updated: 2026-04-19
tags: [architecture]
---

# Architecture

Monorepo, three artifacts.

## Modules

- **backend/** — FastAPI factory app (`main.py::create_app`). Routes, services, Celery workers, Alembic migrations. Port 8000. RS256 JWT auth.
- **frontend/** — Expo Router (TS). Local-first AsyncStorage + BE sync. Web/iOS/Android.
- **bot.py** — Legacy Telegram bot (python-telegram-bot ≥22). Italian UI. Conversation handler with 14 states.

## Backend route map (current)

`agents · analytics · audio · captions · comments · creator_analytics · exports · graphics · health · jobs · media · missions · platforms · projects · reviews · search · subscriptions · teams · thumbnails · tools · tools_analyze · watermark`

See [[Backend Modules]].

## Frontend screens

`(tabs)/{index, agents, activity, analytics, quick-tools, settings}` · `agent/[id]` · `agent/new` · `connect/[platform]` · `mission/[id]` · `mission/launch` · `new-project/*` · `project/[id]` · `tool/[id]` · `login`

See [[Frontend Modules]].

## Data flow (typical creator action)

```
FE upload media
   │
   ▼
POST /media (BE stores blob, returns media_asset.id)
   │
   ▼
[Spec 1 S3] POST /agents/suggest → top-3 agents
   │
   ▼
User picks agent → POST /missions
   │
   ▼
Step Executor runs steps → Celery jobs for heavy ones
   │
   ├─ progress polled via GET /jobs/{id}
   │
   ▼
[Spec 1 S2] PAUSED at preview → user approves
   │
   ▼
Mission COMPLETED → results in project workspace
   │
   ▼
[Spec 2 S7] POST /publish to connected platform
```

## Related

- [[Backend Modules]]
- [[Frontend Modules]]
- [[Database Models]]
- [[Spec 1 — Smart Agents]]
