---
type: decision
status: active
priority: 2
date: 2026-04-18
owner: "Emanuele"
context: "Enforce code style across Python backend/bot and TypeScript frontend"
source: ".raw/rules/code-style.md"
tags: [decision, style, rules]
created: 2026-04-18
updated: 2026-04-18
---

# Code Style Rules

## Python (backend/ + bot.py)

- **Formatting**: Black defaults (88 char line length)
- **Imports**: stdlib → third-party → local, blank-line separated. No wildcard imports.
- **Type hints**: Required on all function signatures. `Optional[X]` for <3.10 compat.
- **Async**: All handlers/service functions `async def`. `httpx.AsyncClient` not `requests`.
- **Errors**: Raise `HTTPException` with status codes at route level. Never swallow exceptions.
- **Naming**: `snake_case` funcs/vars, `PascalCase` classes, `UPPER_SNAKE` consts.
- **Logging**: `logging.getLogger(__name__)`, emoji prefixes: `🚀 starting`, `✅ done`, `❌ error`, `⚠️ warning`.
- **No print()** in backend code. Allowed in seed scripts + CLI tools only.

## TypeScript (frontend/)

- **No `any`** — use `unknown` + type narrowing or proper interfaces. `as any` requires comment.
- **No default exports** in services/hooks/components.
- **Imports**: `@/` path alias. Relative paths max 1 level deep.
- **Components**: Functional only. No class components.
- **State**: `useState` for local UI. Hooks for shared. No prop drilling >2 levels — use context.
- **Styles**: `StyleSheet.create()`. No inline styles except dynamic values. Theme from `@/constants/theme.ts`.
- **Italian UI**: All user-visible strings MUST be Italian.
- **Async in components**: `useEffect` + async IIFE. Never make component function itself async.

## Git

- Commit format: `type(scope): description` (feat|fix|refactor|test|docs|chore)
- One logical change per commit.
- Branch prefixes: `feature/`, `fix/`, `chore/`.

## Related
- [[decisions/api-conventions]]
- [[decisions/testing]]
