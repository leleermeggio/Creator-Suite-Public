---
type: entity
entity_kind: protocol
status: active
tags: [entity, auth, security]
created: 2026-04-18
updated: 2026-04-18
---

# JWT (JSON Web Tokens)

Auth mechanism for Creator Zone. RS256 asymmetric signing.

## Config
- Keys: `backend/keys/private.pem` + `public.pem` (dev committed)
- Env: `JWT_PRIVATE_KEY_PATH=keys/private.pem`
- **Production**: always generate fresh keys (`openssl genrsa -out private.pem 2048`)

## Usage
- Access token + refresh token pair issued on login
- Bearer token header: `Authorization: Bearer <access>`
- Frontend stores in AsyncStorage (`auth_access_token`, `auth_refresh_token`)
- 401 → auto refresh via `apiClient.ts`

## Related
- [[flows/auth-flow]]
- [[decisions/api-conventions]]
- [[decisions/plan-security-hardening]]
