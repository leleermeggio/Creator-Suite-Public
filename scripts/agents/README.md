# Thumbnail Generator — Agent Scripts

Each script launches a focused Claude Code agent for one task.
Run them **in the order and parallelism shown below**.

## Execution Order

```
Task 1 (Foundation)
    ↓
Task 2 + Task 3  ← run in parallel (separate terminals)
    ↓ (both done)
Task 4 (Wiring)
    ↓
Task 5 + Task 6  ← run in parallel (separate terminals)
```

## Commands

```bash
# Step 1 — Foundation (fonts + base class)
bash scripts/agents/task-1-backend-foundation.sh

# Step 2 & 3 — Templates (run in two separate terminals simultaneously)
bash scripts/agents/task-2-templates-batch1.sh   # terminal A
bash scripts/agents/task-3-templates-batch2.sh   # terminal B

# Step 4 — Wire everything together (after 2 & 3 done)
bash scripts/agents/task-4-backend-wiring.sh

# Step 5 & 6 — Tests + Frontend (run in two separate terminals simultaneously)
bash scripts/agents/task-5-backend-tests.sh      # terminal A
bash scripts/agents/task-6-frontend.sh           # terminal B
```

## Plan file
`docs/superpowers/plans/2026-03-27-thumbnail-generator.md`

## Agent types
| Script | Agent type | Stack |
|--------|-----------|-------|
| task-1 | Backend | Python, Pillow |
| task-2 | Backend | Python, Pillow |
| task-3 | Backend | Python, Pillow |
| task-4 | Backend | FastAPI, SQLAlchemy, Celery, Alembic |
| task-5 | Backend | pytest, pytest-asyncio |
| task-6 | Frontend | React Native, TypeScript, Expo |
