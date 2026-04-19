---
type: decision
status: active
priority: 2
date: 2026-04-18
owner: "Emanuele"
context: "Testing rules for backend pytest and frontend TypeScript compilation"
source: ".raw/rules/testing.md"
tags: [decision, testing, rules]
created: 2026-04-18
updated: 2026-04-18
---

# Testing Rules

## Backend (Python / pytest)

- **Location**: `backend/tests/` — mirror source structure
- **Framework**: pytest + pytest-asyncio. All test funcs `async def`.
- **DB**: SQLite in-memory for unit tests. Never use dev DB.
- **Auth**: Test JWT factory. Never hit real `/auth/login`.
- **Fixtures**: `conftest.py` at appropriate level. Shared in `backend/tests/conftest.py`.
- **Naming**: `test_<what>_<condition>_<expected>` — e.g. `test_translate_missing_text_returns_422`
- **Coverage**: 80% target on routes + services (models excluded)
- **What to test**: happy path per route, 401 missing auth, 422 missing fields, 404 missing resource, edge cases in services

## Frontend (TypeScript)

- No test framework yet — when added, Jest + React Native Testing Library
- Baseline: `npx tsc --noEmit`
- Manual test plan in PR description per feature

## Do NOT

- Don't mock DB for integration tests — real SQLite is fast enough
- Don't test implementation details — test behavior + HTTP responses
- Don't commit skipped tests without comment explaining why

## Commands

```bash
python -m pytest backend/tests/ -x -q
python -m pytest backend/tests/ --cov=backend --cov-report=term-missing
cd frontend && npx tsc --noEmit
cd frontend && npx expo export --platform web
```

## Related
- [[decisions/code-style]]
- [[decisions/api-conventions]]
