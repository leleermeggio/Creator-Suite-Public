---
type: flow
status: active
tags: [flow, jobs, celery, async]
created: 2026-04-18
updated: 2026-04-18
---

# Async Job Flow

Celery-backed async pipeline for long-running media operations.

## Entry points

Long-ops routes: transcribe, jumpcut, TTS, convert, watermark.

## Steps

1. Client posts work request
2. Backend creates Job row `status: queued`, returns **202** with `{job_id, status: "queued"}`
3. Celery worker picks task via Redis broker
4. Worker sets `status: processing`, runs pipeline (ffmpeg/Whisper/Gemini/etc.)
5. Worker writes result to `job.result` (JSON), sets `status: completed` or `failed`
6. Client polls `GET /jobs/{job_id}` for terminal state
7. Frontend renders result when `completed`; surfaces error on `failed`

## State transitions

```
queued → processing → completed
queued → processing → failed
```

## Error paths

- Worker crash: task retried per Celery config, max retries → `failed` with error message
- Timeout: worker kills task, status → `failed`
- Invalid input: 422 at route level (job never created)

## Related
- [[modules/backend]] (`workers/`, `services/`)
- [[entities/Celery]]
- [[entities/Redis]]
- [[decisions/api-conventions]]
