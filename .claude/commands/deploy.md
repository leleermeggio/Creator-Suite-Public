Run the deployment checklist for CazZone Creator Suite.

## Pre-flight checks

1. Confirm current branch: `git branch --show-current` — must NOT be deploying directly from `main` unless user confirms.
2. Run TypeScript check: `cd frontend && npx tsc --noEmit`
3. Run backend tests: `python -m pytest backend/tests/ -x -q`
4. Check for uncommitted changes: `git status`
5. Verify `backend/.env` has `GOOGLE_API_KEY` set (check it's not empty).
6. Verify `ALLOWED_ORIGINS` in `backend/.env` includes the production frontend URL.

## Backend deploy (Docker)

```bash
cd backend
docker compose build --no-cache api
docker compose run --rm api python -m alembic -c /app/backend/alembic.ini upgrade head
docker compose up -d api worker
docker compose logs -f api
```

## Frontend deploy (web)

```bash
cd frontend
npx expo export --platform web
# Then drag dist/ to Netlify or run: netlify deploy --dir=dist --prod
```

## Post-deploy verification

1. Hit `GET /health` on the deployed API — expect `{"status": "ok"}`.
2. Try login with `POST /auth/login` — expect 200 + tokens.
3. Open the web frontend URL — verify it loads and reaches the API.
4. Report: deploy URL, API URL, any errors found.

Stop and ask the user before executing any step that pushes to production.
