---
title: Tool
updated: 2026-04-19
tags: [concept, backend]
---

# Tool

Atomic operation invoked by a [[Step Executor]]. Each tool wraps a service in `backend/services/`.

## Inventory (10)

| tool_id | Service | Sync? |
|---------|---------|-------|
| download | `downloader_service` | async (Celery) |
| transcribe | `transcriber_service` | async (Celery) |
| jumpcut | `jumpcut_service` | async (Celery) |
| caption | `caption_export_service` / `caption_burnin_service` | async |
| thumbnail | `thumbnail_service` | sync-fast or async |
| export | `exporter_service` / `convert_service` | async |
| audio_cleanup | `audio_cleanup_service` | async |
| translate | `translation_service` | sync (`/tools/translate`) |
| tts | `tts_service` | async |
| analyze_media | `media_analysis_service` | sync (Gemini) |

Plus standalone `/tools/*` endpoints (translate, summarize, OCR) — synchronous. See `.claude/rules/api-conventions.md` § Tools Endpoints.

## Related

- [[Step Executor]]
- [[Agent]]
