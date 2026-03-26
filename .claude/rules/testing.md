# Testing Rules — CazZone Creator Suite

## Backend (Python / pytest)

- **Location**: `backend/tests/` — mirror the source structure (`tests/routes/`, `tests/services/`, etc.)
- **Framework**: pytest + pytest-asyncio. All test functions are `async def`.
- **DB**: Use SQLite in-memory for unit tests. Never use the dev DB in tests.
- **Auth**: Use a test JWT factory — never hit real `/auth/login` in unit tests.
- **Fixtures**: Define in `conftest.py` at the appropriate level. Shared fixtures go in `backend/tests/conftest.py`.
- **Naming**: `test_<what>_<condition>_<expected>` — e.g. `test_translate_missing_text_returns_422`
- **Coverage target**: 80% on routes and services. Models excluded.
- **What to test**:
  - Happy path for every route
  - 401 when auth header missing
  - 422 when required fields missing
  - 404 when resource not found
  - Business logic edge cases in services

## Frontend (TypeScript)

- No test framework currently set up — when added, use Jest + React Native Testing Library.
- Until then: TypeScript compilation (`npx tsc --noEmit`) is the baseline check.
- Manual test plan for each feature: write it in the PR description.

## Running tests

```bash
# Backend unit tests
cd //LA-BASE/Spazio\ Ai/windsurf-project-2
python -m pytest backend/tests/ -x -q

# Backend with coverage
python -m pytest backend/tests/ --cov=backend --cov-report=term-missing

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend web build (smoke test)
cd frontend && npx expo export --platform web
```

## Do NOT

- Don't mock the database for integration tests — real SQLite is fast enough
- Don't test implementation details — test behavior and HTTP responses
- Don't commit tests that are skipped without a comment explaining why
