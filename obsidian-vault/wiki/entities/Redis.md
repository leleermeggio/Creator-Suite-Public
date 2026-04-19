---
type: entity
entity_kind: infra
status: active
tags: [entity, infra, broker]
created: 2026-04-18
updated: 2026-04-18
---

# Redis

Message broker for Celery workers. Required for backend async jobs.

## Config
- Env: `REDIS_URL=redis://localhost:6379/0`
- Dev: local install or Docker Compose
- Prod: managed Redis or Docker service

## Related
- [[entities/Celery]]
- [[flows/async-job-flow]]
