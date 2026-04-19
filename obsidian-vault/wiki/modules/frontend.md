---
type: module
path: "frontend/"
status: active
language: typescript
purpose: "Expo Router tab-based creator app, local-first (AsyncStorage) + BE sync"
maintainer: "Emanuele"
depends_on: ["[[entities/Expo]]", "[[entities/ReactNative]]", "[[modules/backend]]"]
used_by: []
tags: [module, frontend]
created: 2026-04-18
updated: 2026-04-18
---

# Frontend

Expo Router tab navigator. TypeScript strict. Cosmic neon theme.

## Submodules

| Path | Role |
|------|------|
| `app/(tabs)/` | Tab navigator: Projects, Quick Tools, Activity, Settings |
| `app/project/[id].tsx` | Project workspace (phases, files, tools) |
| `app/new-project/` | Project creation flow (template → customize → create) |
| `app/tool/[id].tsx` | Tool execution screen (9 tools) |
| `app/login.tsx` | Auth screen |
| `services/apiClient.ts` | Centralized API client (JWT, auto-refresh, error handling) |
| `services/authApi.ts` | Auth endpoints wrapper |
| `services/projectsApi.ts` | Projects BE sync |
| `hooks/useAuth.ts` | Auth state + login/logout |
| `hooks/useProjects.ts` | Project list (hybrid: BE id + local phases) |
| `hooks/useProject.ts` | Single project (phases, files, advance) |
| `context/AuthContext.tsx` | Auth React context |

## Patterns

- Projects: BE owns `{id, title}`, AsyncStorage owns `phases[]` keyed by BE project id → see [[concepts/hybrid-storage]]
- Tools route through BE (`/tools/*`, `/thumbnails/generate`) — no API keys in FE
- JWT stored in AsyncStorage (`auth_access_token`, `auth_refresh_token`)
- 401 auto-triggers token refresh then retry → see [[flows/auth-flow]]
- All user-visible strings in Italian → see [[decisions/code-style]]

## Related

- [[flows/auth-flow]]
- [[flows/projects-sync]]
- [[decisions/code-style]]
