Review the code changes in the current working context.

## Steps

1. Run `git diff HEAD` to see all unstaged changes. If no unstaged changes, run `git diff HEAD~1` to see the last commit.
2. Identify which part of the monorepo is affected: `backend/`, `frontend/`, or `bot.py`.
3. Apply the relevant rules:
   - For backend: @.claude/rules/api-conventions.md and @.claude/rules/code-style.md
   - For frontend: @.claude/rules/code-style.md
   - For all: @.claude/rules/testing.md
4. Check for:
   - Security issues: hardcoded secrets, SQL injection, missing auth guards, exposed API keys in FE
   - Type safety: missing type hints (Python) or `any` types (TypeScript)
   - Async correctness: no blocking calls in async context, no missing `await`
   - Italian UI strings: all user-facing text in frontend must be in Italian
   - Breaking changes: modified API schemas, removed endpoints, changed response shapes
5. Report findings grouped by: **Critical** → **Warning** → **Suggestion**
6. For each critical issue, show the exact line and the fix.

Be concise. Skip praise. Only report real issues.
