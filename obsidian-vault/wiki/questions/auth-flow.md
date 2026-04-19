---
type: question
status: answered
asked: 2026-04-19
tags: [question, auth]
created: 2026-04-19
updated: 2026-04-19
---

# Q: What do you know about the auth flow?

## Answer

Creator Zone uses **JWT RS256** with refresh token rotation. Login issues `{access, refresh}` pair stored in frontend AsyncStorage (`auth_access_token`, `auth_refresh_token`). All protected endpoints require `Authorization: Bearer <access>`. On 401, `apiClient.ts` auto-refreshes via `/auth/refresh` and retries; on refresh failure, user is redirected to `login.tsx`.

Endpoints: `POST /auth/register`, `POST /auth/login` (rate-limited 5/min via slowapi), `POST /auth/refresh`, `GET /auth/me`. Dev-only: keys at `backend/keys/private.pem` + `public.pem` (production must generate fresh).

See [[flows/auth-flow]] for the state transition diagram and error paths.

## Sources
- [[flows/auth-flow]]
- [[modules/backend]]
- [[modules/frontend]]
- [[entities/JWT]]
- [[decisions/api-conventions]]
