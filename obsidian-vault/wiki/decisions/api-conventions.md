---
type: decision
status: active
priority: 1
date: 2026-04-18
owner: "Emanuele"
context: "REST design rules for backend endpoints, schemas, auth, async jobs"
source: ".raw/rules/api-conventions.md"
tags: [decision, api, rules, backend]
created: 2026-04-18
updated: 2026-04-18
---

# API Conventions

## REST design

- **Versioning**: No prefix currently (`/projects/`, not `/v1/projects/`). Breaking change → `/v2/`.
- **Resources**: Plural nouns — `/projects/`, `/jobs/`, `/media/`, `/captions/`
- **Actions**: POST to sub-resources — `/captions/{id}/translate`, `/thumbnails/extract-frame`
- **IDs**: UUIDs as strings. Never expose sequential integers externally.

## HTTP status codes

| Situation | Code |
|-----------|------|
| Created | 201 |
| Accepted async | 202 |
| No content (delete) | 204 |
| Validation error | 422 |
| Auth required | 401 |
| Forbidden (wrong user) | 403 |
| Not found | 404 |
| Rate limited | 429 |

## Request/Response

- JSON bodies only
- Timestamps: ISO 8601 UTC (`"2024-01-15T10:30:00Z"`)
- Nullable fields: `field: str | None = None`, never omit
- Lists return plain arrays (not `{"items": [...]}`)
- Async job responses: always 202, shape `{ "job_id": "uuid", "status": "queued" }`

## Auth

- All endpoints except `/auth/*` + `/health` require `Authorization: Bearer <token>`
- `get_current_user` dependency from `backend.auth.dependencies`
- Always scope queries to `user_id` — never return other users' data

## Pydantic schemas

- `*Create` — inputs only, no `id`/`user_id`/timestamps
- `*Update` — all fields optional
- `*Response` — all fields including timestamps
- Validation: `Field(min_length=1, max_length=255)` on strings
- **Never** return `hashed_password`

## Error format

FastAPI default 422. Custom: `{ "detail": "Descrizione errore in inglese" }`. Logs/API English, Italian only in frontend UI.

## Async jobs

For transcribe/jumpcut/TTS/convert:
1. Create Job record `status: queued`
2. Return 202 with `{job_id, status}`
3. Enqueue to Celery worker
4. Client polls `GET /jobs/{job_id}`
5. Result in `job.result` field (JSON)

See [[flows/async-job-flow]].

## Tools endpoints (`/tools/`)

Synchronous — only fast ops (translate, summarize, OCR). Response `{ "result": "<string>" }`. Auth required. Never expose external API keys.

## Related
- [[decisions/code-style]]
- [[decisions/testing]]
- [[flows/async-job-flow]]
- [[flows/auth-flow]]
- [[modules/backend]]
