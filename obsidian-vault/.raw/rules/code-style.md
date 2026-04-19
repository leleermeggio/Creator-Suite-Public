# Code Style Rules — Creator Zone

## Python (backend/ + bot.py)

- **Formatting**: Black defaults (88 char line length). No manual formatting needed.
- **Imports**: stdlib → third-party → local, separated by blank lines. No wildcard imports.
- **Type hints**: Required on all function signatures. Use `Optional[X]` over `X | None` for Python <3.10 compat. Use `list[X]` / `dict[K,V]` (lowercase) for Python ≥3.10.
- **Async**: All handlers and service functions must be `async def`. Never call sync blocking I/O inside async functions. Use `httpx.AsyncClient` not `requests`.
- **Error handling**: Raise `HTTPException` with appropriate status codes at route level. Never swallow exceptions silently.
- **Naming**: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for module-level constants.
- **Logging**: Use `logging.getLogger(__name__)`. Prefix messages with emojis for visual scanning: `🚀 starting`, `✅ done`, `❌ error`, `⚠️ warning`.
- **No print()**: Use logger in all backend code. `print()` allowed only in seed scripts and CLI tools.

## TypeScript (frontend/)

- **No `any`**: Use `unknown` + type narrowing, or define a proper interface. `as any` requires a comment explaining why.
- **No default exports**: Named exports only in services, hooks, and components.
- **Imports**: Use `@/` path alias (configured in tsconfig). Never use relative `../../` paths more than 1 level deep.
- **Components**: Functional components only. No class components.
- **State**: `useState` for local UI state. Hooks for shared state. No prop drilling more than 2 levels — use context.
- **Styles**: All styles via `StyleSheet.create()`. No inline style objects except for dynamic values (color, width from props). Theme values always from `@/constants/theme.ts`.
- **Italian UI**: All user-visible strings MUST be in Italian. Error messages, labels, placeholders, buttons — all Italian.
- **Async in components**: Use `useEffect` + async IIFE or dedicated hooks. Never make a component function itself async.

## Git

- Commit messages: `type(scope): description` — e.g. `feat(backend): add /tools/translate endpoint`
- Types: `feat` | `fix` | `refactor` | `test` | `docs` | `chore`
- One logical change per commit. Don't bundle unrelated changes.
- Branch names: `feature/`, `fix/`, `chore/` prefixes.
