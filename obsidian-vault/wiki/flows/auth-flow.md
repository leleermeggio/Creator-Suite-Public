---
type: flow
status: active
tags: [flow, auth, jwt]
created: 2026-04-18
updated: 2026-04-18
---

# Auth Flow

JWT RS256 with refresh token rotation. Shared between backend + frontend.

## Entry points

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/auth/register` | Create user + return tokens |
| POST | `/auth/login` | Credentials → `{access, refresh}` (rate-limited 5/min) |
| POST | `/auth/refresh` | Refresh token → new access token |
| GET | `/auth/me` | Current user profile |

## Steps — login

1. FE posts `{email, password}` to `/auth/login`
2. BE verifies credentials (bcrypt), issues `{access, refresh}`
3. FE persists tokens to AsyncStorage: `auth_access_token`, `auth_refresh_token`
4. All subsequent requests: `Authorization: Bearer <access>`

## Steps — auto-refresh on 401

1. Protected request returns 401
2. `apiClient.ts` intercepts, calls `/auth/refresh` with refresh token
3. On success: new access token stored, original request retried
4. On failure: clear storage, redirect to `login.tsx`

## State transitions

```
logged_out → (login) → authenticated
authenticated → (401 + refresh OK) → authenticated
authenticated → (401 + refresh FAIL) → logged_out
authenticated → (logout) → logged_out
```

## Error paths

- 401 missing header → backend returns, FE redirects login
- 403 wrong user scope → backend denies, FE shows error
- 422 missing fields → backend validation, FE shows form errors
- 429 rate-limited → FE shows cooldown message

## Related
- [[modules/backend]] (`auth/` submodule)
- [[modules/frontend]] (`hooks/useAuth.ts`, `services/apiClient.ts`)
- [[entities/JWT]]
- [[decisions/api-conventions]]
