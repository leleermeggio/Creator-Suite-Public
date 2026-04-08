# Deploy Workflow

Structured deployment checklist for Creator Zone.

## Pre-deploy (always run first)

```bash
# 1. Type check frontend
cd frontend && npx tsc --noEmit

# 2. Backend tests
cd .. && python -m pytest backend/tests/ -x -q

# 3. No uncommitted changes
git status

# 4. On correct branch
git branch --show-current
```

Stop if any step fails. Do not deploy broken code.

## Backend — Docker Deploy

```bash
cd backend

# Build fresh image
docker compose build --no-cache api worker

# Run migrations BEFORE bringing up new api
docker compose run --rm api \
  python -m alembic -c /app/backend/alembic.ini upgrade head

# Rolling restart
docker compose up -d api worker

# Tail logs for 30 seconds
docker compose logs -f api --tail=50
```

Check for: startup errors, migration failures, port conflicts.

## Backend — Verify

```bash
# Health check
curl -s http://127.0.0.1:8000/health | python -m json.tool

# Auth check
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<DEV_EMAIL>","password":"<DEV_PASSWORD>"}' | python -m json.tool
```

Expected: `{"status":"ok"}` and `{"access_token":"..."}`.

## Frontend — Web Deploy

```bash
cd frontend

# Production build
npx expo export --platform web

# Option A: Netlify CLI
netlify deploy --dir=dist --prod

# Option B: Manual — drag dist/ folder to https://app.netlify.com/drop
```

## Frontend — Android APK (EAS)

```bash
cd frontend
eas login
eas build --platform android --profile preview
# Download APK from the EAS dashboard URL printed after build
```

## Post-deploy

- [ ] Web URL loads in browser
- [ ] Login with dev credentials from `backend/.env` (DEV_EMAIL / DEV_PASSWORD) works
- [ ] Create a test project — verify it appears in the list
- [ ] Run one tool (translate) — verify result appears
- [ ] Check no console errors in browser DevTools

## Rollback

```bash
# Backend: revert to previous image
docker compose down api worker
docker compose up -d --scale api=0
git checkout HEAD~1 -- backend/
docker compose build api && docker compose up -d api

# Frontend: redeploy previous dist from git
git stash && npx expo export --platform web && netlify deploy --dir=dist --prod
```
