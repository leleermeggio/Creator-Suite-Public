---
type: entity
entity_kind: framework
status: active
tags: [entity, backend, framework]
created: 2026-04-18
updated: 2026-04-18
---

# FastAPI

Primary web framework for Creator Zone backend. Python 3.11. Factory pattern `create_app()`. Port 8000.

## Role in project
- REST endpoints for projects, jobs, media, captions, audio, thumbnails, graphics, tools, exports, search, watermark, teams, subscriptions, analytics
- Async request handlers (all `async def`)
- Dependency injection for auth (`get_current_user`)
- Pydantic schema validation

## Related
- [[modules/backend]]
- [[decisions/api-conventions]]
- [[decisions/code-style]]
