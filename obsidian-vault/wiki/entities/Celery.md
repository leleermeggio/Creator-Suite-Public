---
type: entity
entity_kind: framework
status: active
tags: [entity, backend, async, jobs]
created: 2026-04-18
updated: 2026-04-18
---

# Celery

Async task queue for long-running media operations (transcribe, jumpcut, TTS, convert, watermark).

## Role in project
- Workers under `backend/workers/`
- Broker: Redis (`REDIS_URL`)
- Route enqueues, worker processes, result stored in `Job.result`
- Client polls `GET /jobs/{job_id}` for terminal state

## Related
- [[flows/async-job-flow]]
- [[entities/Redis]]
- [[modules/backend]]
