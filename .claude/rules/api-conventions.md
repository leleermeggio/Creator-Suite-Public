# API Conventions — Creator Zone

## REST Design

- **Versioning**: No prefix currently (`/projects/`, not `/v1/projects/`). Add `/v2/` only on breaking changes.
- **Resources**: Plural nouns — `/projects/`, `/jobs/`, `/media/`, `/captions/`
- **Actions**: POST to sub-resources — `/captions/{id}/translate`, `/thumbnails/extract-frame`
- **IDs**: UUIDs as strings in all responses. Never expose sequential integer IDs externally.

## HTTP Status Codes

| Situation | Code |
|-----------|------|
| Created resource | 201 |
| Accepted async job | 202 |
| No content (delete) | 204 |
| Validation error | 422 |
| Auth required | 401 |
| Forbidden (wrong user) | 403 |
| Not found | 404 |
| Rate limited | 429 |

## Request/Response

- All bodies are JSON (`Content-Type: application/json`)
- All timestamps are ISO 8601 strings in UTC: `"2024-01-15T10:30:00Z"`
- Nullable fields: use `field: str | None = None`, never omit the field entirely
- List endpoints return plain arrays, not `{ "items": [...] }` wrappers
- Async job responses: `{ "job_id": "uuid", "status": "queued" }` — always 202

## Auth

- All endpoints (except `/auth/*` and `/health`) require `Authorization: Bearer <token>`
- Use `get_current_user` dependency from `backend.auth.dependencies`
- Always scope queries to `user_id` — never return other users' data
- Example:
  ```python
  @router.get("/projects/")
  async def list_projects(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
      return await get_projects_for_user(db, user.id)  # scoped to user
  ```

## Pydantic Schemas

- `*Create` schema: input fields only, no `id`/`user_id`/timestamps
- `*Update` schema: all fields optional (`field: type | None = None`)
- `*Response` schema: all fields including `id`, `user_id`, `created_at`
- Field validation: use `Field(min_length=1, max_length=255)` on string fields
- Never return the `hashed_password` field — ever

## Error Format

FastAPI default 422 format is used. For custom errors:
```json
{ "detail": "Descrizione errore in inglese" }
```
Error messages are in English (logs/API). Italian only in the frontend UI.

## Async Jobs

For long-running operations (transcribe, jumpcut, TTS, convert):
1. Accept the request, create a Job record with `status: queued`
2. Return 202 immediately: `{ "job_id": "...", "status": "queued" }`
3. Enqueue to Celery worker
4. Client polls `GET /jobs/{job_id}` for `status: completed | failed`
5. Result available in `job.result` field (JSON object)

## Tools Endpoints (`/tools/`)

Synchronous — suitable only for fast operations (translate, summarize, OCR).
Response shape: `{ "result": "<string>" }`
Always require auth. Never expose external API keys in responses.
