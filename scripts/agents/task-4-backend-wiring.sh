#!/usr/bin/env bash
# ============================================================
# AGENT: Task 4 — Backend Wiring
# Implements: thumbnail_service.py, schema, model, migration,
#             tasks.py update, route update
# Type: Backend Python agent
# Requires: Tasks 1 + 2 + 3 complete
# Run: bash scripts/agents/task-4-backend-wiring.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 4"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior Python backend developer (FastAPI, SQLAlchemy, Celery).
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Backend Wiring) from the plan.
Steps to complete:
  4.1 Create backend/services/thumbnail_service.py (full code in plan)
  4.2 Replace backend/schemas/thumbnail.py (full code in plan)
  4.3 Add template_id column to backend/models/thumbnail.py
  4.4 Run 'alembic revision --autogenerate' and 'alembic upgrade head' inside backend/
  4.5 Add generate_thumbnail action to _handle_thumbnail_or_watermark in backend/workers/tasks.py
  4.6 Replace /generate endpoint in backend/routes/thumbnails.py (full code in plan)
  4.7 Commit

Important notes:
- In step 4.5 ADD the new action block at the TOP of _handle_thumbnail_or_watermark,
  keeping the existing watermark_image block untouched
- In step 4.6 replace ONLY the generate_thumbnail endpoint function, not the entire file
- Use superpowers:executing-plans to track progress
"
