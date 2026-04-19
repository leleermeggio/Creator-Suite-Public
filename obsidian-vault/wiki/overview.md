---
type: meta
title: "Creator Zone — Overview"
status: draft
created: 2026-04-18
updated: 2026-04-18
tags: [overview, meta]
---

# Creator Zone — Project Overview

Creator Zone is a content creator toolkit exposed via three surfaces:

| Surface | Stack | Role |
|---------|-------|------|
| Backend | FastAPI, Python 3.11, SQLAlchemy async, Celery, Redis | REST API, async jobs, media processing, AI tools |
| Frontend | Expo Router, React Native, TypeScript | Tab-based creator app (Projects, Quick Tools, Activity, Settings) |
| Telegram Bot | python-telegram-bot ≥22, Whisper, ffmpeg | Legacy single-process bot, 14-state ConversationHandler |

## Architectural highlights

- JWT RS256 auth shared across backend; frontend stores tokens in AsyncStorage with auto-refresh on 401.
- Tools (translate, summarize, OCR, thumbnail) routed through backend — no API keys in frontend.
- Async jobs (`POST` → 202 `{job_id, status: queued}`) for transcription, TTS, jumpcut, convert — Celery workers.
- Rate limiting via slowapi (5/min on auth endpoints).
- Media storage: Cloudflare R2 prod, local paths dev.

## Initiatives in flight

- Security hardening plan (2026-04-04)
- Local LLM fresh setup (2026-04-07)
- Avatar profile feature (2026-04-08)

_Detail pages populated via ingest of `docs/superpowers/plans/*` and `docs/superpowers/specs/*`._

## Conventions

See [[CLAUDE]] (vault root) for schema and operation commands.
Project code conventions: [[decisions/code-style]], [[decisions/api-conventions]], [[decisions/testing]] (to be ingested).
