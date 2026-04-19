---
type: decision
status: active
priority: 3
date: 2026-04-08
owner: "Emanuele"
context: "Custom avatar upload + profile card in Settings + avatar badge in FloatingTabBar"
source: ".raw/superpowers-plans/2026-04-08-avatar-profile.md"
spec: ".raw/superpowers-specs/2026-04-08-avatar-profile-design.md"
tags: [decision, plan, feature, avatar, profile]
created: 2026-04-18
updated: 2026-04-18
---

# Plan — Avatar & Profile Section

## Goal
Custom avatar upload, profile card in Settings, avatar badge in FloatingTabBar replacing Settings tab emoji.

## Architecture
- **Backend**: `avatar_url` column on User, `PUT /auth/me` for name edits, `POST /auth/avatar` multipart upload serving files from `backend/static/avatars/`.
- **Frontend**: pure React Native `Avatar` component (initials fallback, neon glow ring). Profile card at top of Settings. Live avatar replaces Settings tab emoji in FloatingTabBar.

## Tech stack
FastAPI + SQLAlchemy (backend), React Native + Expo (frontend), `expo-image-picker` (gallery access), `fetch` (multipart upload).

## Scope
- `backend/models/user.py` — add `avatar_url` column
- `backend/auth/schemas.py` — add `avatar_url` to `UserResponse`, add `ProfileUpdate` schema
- `backend/auth/routes.py` — add `PUT /auth/me`, `POST /auth/avatar`
- `backend/main.py` — mount `StaticFiles` at `/static`

## Related
- [[modules/backend]]
- [[modules/frontend]]
- [[flows/auth-flow]]

## Status
Backend avatar uploads ignored in gitignore per recent commit `defa1bc chore: ignore uploaded avatar files in backend`. Implementation in progress.
