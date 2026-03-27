#!/usr/bin/env bash
# ============================================================
# AGENT: Task 5 — Backend Tests
# Implements: test_thumbnail_service.py, updates test_thumbnail_routes.py
# Type: Backend Python agent
# Requires: Task 4 complete
# Run: bash scripts/agents/task-5-backend-tests.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 5"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior Python backend developer focused on testing (pytest, pytest-asyncio).
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Backend Tests) from the plan.
Steps to complete:
  5.1 Create backend/tests/services/test_thumbnail_service.py (full code in plan)
  5.2 Run the new tests: python -m pytest backend/tests/services/test_thumbnail_service.py -v
      Fix any failures before continuing.
  5.3 Replace backend/tests/test_thumbnail_routes.py with the updated version (full code in plan)
  5.4 Run both test files: python -m pytest backend/tests/services/test_thumbnail_service.py backend/tests/test_thumbnail_routes.py -v
  5.5 Run full suite: python -m pytest backend/tests/ -x -q
      Fix any regressions before continuing.
  5.6 Commit

Rules:
- ALL tests must pass before committing
- Do NOT skip or xfail tests without a documented reason
- Use superpowers:systematic-debugging if a test fails unexpectedly
- Use superpowers:executing-plans to track progress
"
