#!/usr/bin/env bash
# ============================================================
# AGENT: Task 3 — Templates Batch 2
# Implements: minimal.py, reaction.py, neon.py, cinematic.py
# Type: Backend Python agent
# Requires: Task 1 complete (can run in parallel with Task 2)
# Run: bash scripts/agents/task-3-templates-batch2.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 3"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior Python backend developer specializing in Pillow image processing.
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Templates Batch 2) from the plan.
Steps to complete:
  3.1 Create backend/services/thumbnail_templates/minimal.py (full code in plan)
  3.2 Create backend/services/thumbnail_templates/reaction.py (full code in plan)
  3.3 Create backend/services/thumbnail_templates/neon.py (full code in plan)
  3.4 Create backend/services/thumbnail_templates/cinematic.py (full code in plan)
  3.5 Commit

Rules:
- Do NOT implement any other task
- Copy the code exactly from the plan — do not improvise
- Use superpowers:executing-plans to track progress
"
