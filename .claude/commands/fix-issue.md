Fix a GitHub issue or bug described by the user.

## Steps

1. Ask the user for the issue number or bug description if not provided.
2. Read all relevant files before touching anything — understand the full context.
3. Identify which layer is affected: backend route/service/model, frontend component/hook/service, or bot handler.
4. Write a minimal fix — do not refactor surrounding code, do not add features, do not change unrelated logic.
5. Check your fix against @.claude/rules/code-style.md conventions.
6. For backend changes: verify the Pydantic schema is consistent with the route and the model.
7. For frontend changes: verify TypeScript types are correct, no `any` introduced.
8. Run the relevant check:
   - Backend: `cd //LA-BASE/Spazio\ Ai/windsurf-project-2 && python -m pytest backend/tests/ -x -q`
   - Frontend: `cd //LA-BASE/Spazio\ Ai/windsurf-project-2/frontend && npx tsc --noEmit`
9. Show a summary: what was broken, what was changed, what to test manually.

Do NOT open a PR or commit automatically — let the user review first.
