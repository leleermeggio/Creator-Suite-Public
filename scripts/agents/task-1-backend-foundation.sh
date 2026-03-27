#!/usr/bin/env bash
# ============================================================
# AGENT: Task 1 — Backend Foundation
# Implements: base.py, ThumbnailContext, font download
# Type: Backend Python agent
# Run: bash scripts/agents/task-1-backend-foundation.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 1"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior Python backend developer.
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Backend Foundation) from the plan.
Steps to complete:
  1.1 Download Anton-Regular.ttf and Oswald-Bold.ttf into backend/assets/fonts/
  1.2 Create backend/services/thumbnail_templates/__init__.py and base.py exactly as shown in the plan
  1.3 Commit

Rules:
- Do NOT implement any other task
- Follow every step and code block in the plan exactly
- Run the commit step when done
- Use superpowers:executing-plans to track progress
"
